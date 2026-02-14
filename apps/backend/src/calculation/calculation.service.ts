import { Injectable, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import {
  TentDimensions,
  Brace,
  Rail,
  ColumnType,
  Column,
  RailSegment,
  Scenario,
  DPSolution,
} from '../shared/types';
import { CalculateRequestDto, CalculateResponseDto } from './dto';

/** Rail thickness in meters (5cm) - exported for potential use */
export const RAIL_THICKNESS = 0.05;

/** Minimum setback from tent edges in meters (8cm) */
const MIN_SETBACK = 0.08;

/** Maximum setback from tent edges in meters (25cm) */
const MAX_SETBACK = 0.25;

/** Maximum additional setback beyond minimum */
const MAX_SETBACK_INCREASE = MAX_SETBACK - MIN_SETBACK; // 0.17

/** Precision for discretization in meters (1cm) */
const PRECISION = 0.01;

/** Maximum allowed gap per column in meters (39cm) */
const MAX_COLUMN_GAP = 0.39;

/** Scenario name labels */
const SCENARIO_NAMES = [
  'Best Width Fit',
  'Minimum Gaps',
  'Least Brace Kinds',
  'Least Rails',
  'Least Braces',
  'Biggest Braces',
  'Balanced',
  'Balanced 2',
  'Balanced 3',
  'Balanced 4',
];

@Injectable()
export class CalculationService {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Main calculation endpoint
   * Tries both orientations (which dimension becomes rail direction vs column direction)
   * and returns the best scenarios from all possibilities
   */
  calculate(request: CalculateRequestDto): CalculateResponseDto {
    const { tent } = request;

    // Validate tent dimensions
    this.validateTentDimensions(tent);

    // Get and validate inventory
    const inventory = this.inventoryService.mergeWithDefaults(request.inventory);
    const validation = this.inventoryService.validateInventory(inventory);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    // Collect ALL DPSolutions tagged with their oriented tent dimensions
    const taggedSolutions: { solution: DPSolution; orientedTent: TentDimensions }[] = [];
    const errors: string[] = [];

    // Try Orientation 1: Original dimensions
    try {
      const solutions1 = this.calculateForOrientation(tent.length, tent.width, inventory);
      const orientedTent1: TentDimensions = { length: tent.length, width: tent.width };
      for (const sol of solutions1) {
        taggedSolutions.push({ solution: sol, orientedTent: orientedTent1 });
      }
    } catch (err) {
      if (err instanceof BadRequestException) {
        errors.push(`Orientation 1 (${tent.length}m rails x ${tent.width}m columns): ${err.message}`);
      } else {
        throw err;
      }
    }

    // Try Orientation 2: Swapped dimensions (only if non-square)
    if (Math.abs(tent.length - tent.width) > 0.01) {
      try {
        const solutions2 = this.calculateForOrientation(tent.width, tent.length, inventory);
        const orientedTent2: TentDimensions = { length: tent.width, width: tent.length };
        for (const sol of solutions2) {
          taggedSolutions.push({ solution: sol, orientedTent: orientedTent2 });
        }
      } catch (err) {
        if (err instanceof BadRequestException) {
          errors.push(`Orientation 2 (${tent.width}m rails x ${tent.length}m columns): ${err.message}`);
        } else {
          throw err;
        }
      }
    }

    if (taggedSolutions.length === 0) {
      throw new BadRequestException(
        'No valid floor plan found in either orientation. ' +
        'Insufficient inventory or tent dimensions too challenging.\n' +
        errors.join('\n'),
      );
    }

    // Single named selection from the FULL pool
    const allDPSolutions = taggedSolutions.map((t) => t.solution);
    const selectedSolutions = this.selectNamedScenarios(allDPSolutions);

    // Construct scenarios only for selected solutions
    const scenarios = selectedSolutions.map((sol, index) => {
      const tagged = taggedSolutions.find((t) => t.solution === sol)!;
      const scenario = this.constructScenario(
        sol,
        SCENARIO_NAMES[index] || `Scenario ${index + 1}`,
        tagged.orientedTent,
        inventory.rails,
      );
      return scenario;
    });

    return {
      scenarios,
      tent,
    };
  }

  /**
   * Calculate floor plan for a specific orientation
   * Returns raw DPSolution[] (no Pareto selection or scenario construction)
   * @param railLength - Dimension along which rails run (braces fill this direction)
   * @param columnSpan - Dimension across which columns are placed
   * @param inventory - Brace and rail inventory
   */
  private calculateForOrientation(
    railLength: number,
    columnSpan: number,
    inventory: { braces: Brace[]; rails: Rail[] },
  ): DPSolution[] {
    // Calculate usable dimensions with minimum setback
    const usableLength = railLength - 2 * MIN_SETBACK;
    const usableWidth = columnSpan - 2 * MIN_SETBACK;

    if (usableLength <= 0 || usableWidth <= 0) {
      throw new BadRequestException(
        `Tent too small: usable area would be ${usableLength.toFixed(2)}m x ${usableWidth.toFixed(2)}m`,
      );
    }

    // Generate all possible column types (using max usable length = min setback)
    const columnTypes = this.generateColumnTypes(inventory.braces, usableLength);

    if (columnTypes.length === 0) {
      throw new BadRequestException(
        'No braces can fit in the usable length. Check brace dimensions.',
      );
    }

    // Validate that inventory has enough braces to cover a meaningful floor area
    this.validateBraceInventory(inventory.braces, usableLength, usableWidth);

    // Find column combinations using DP (with brace quantity tracking)
    const solutions = this.dpColumnSearch(columnTypes, usableWidth, inventory.braces);

    if (solutions.length === 0) {
      throw new BadRequestException(
        'No valid floor plan found. Insufficient inventory for this orientation.',
      );
    }

    // Step 2.5: Open-end optimization (setback sweep) for each solution
    const optimizedSolutions = this.optimizeOpenEndSetbacks(solutions, railLength);

    // Filter invalid solutions (any setback out of [MIN_SETBACK, MAX_SETBACK])
    const validSolutions = optimizedSolutions.filter((sol) => {
      const widthSetback = MIN_SETBACK + sol.setbackExcess / 2;
      if (widthSetback < MIN_SETBACK - 0.001 || widthSetback > MAX_SETBACK + 0.001) {
        return false;
      }
      if ((sol.openEndSetbackStart ?? 0) < MIN_SETBACK - 0.001 ||
          (sol.openEndSetbackStart ?? 0) > MAX_SETBACK + 0.001) {
        return false;
      }
      if ((sol.openEndSetbackEnd ?? 0) < MIN_SETBACK - 0.001 ||
          (sol.openEndSetbackEnd ?? 0) > MAX_SETBACK + 0.001) {
        return false;
      }
      return true;
    });

    // Filter solutions where any column gap exceeds MAX_COLUMN_GAP
    const gapFilteredSolutions = validSolutions.filter((sol) =>
      sol.columns.every((col) => col.gap <= MAX_COLUMN_GAP + 0.001),
    );

    // Fallback: if gap filter removes everything, use validSolutions
    if (gapFilteredSolutions.length === 0) {
      return validSolutions;
    }

    return gapFilteredSolutions;
  }

  /**
   * Validate tent dimensions
   */
  private validateTentDimensions(tent: TentDimensions): void {
    if (tent.length <= 0 || tent.width <= 0) {
      throw new BadRequestException('Tent dimensions must be positive');
    }
    if (tent.length < 2 * MIN_SETBACK || tent.width < 2 * MIN_SETBACK) {
      throw new BadRequestException(
        `Tent dimensions must be at least ${2 * MIN_SETBACK}m to accommodate minimum setback`,
      );
    }
  }

  /**
   * Validate that the brace inventory has enough panels to cover at least
   * one column of the floor. This is a quick pre-check before running DP.
   */
  private validateBraceInventory(
    braces: Brace[],
    usableLength: number,
    usableWidth: number,
  ): void {
    // Calculate total area that all braces can cover
    let totalBraceArea = 0;
    for (const brace of braces) {
      totalBraceArea += brace.length * brace.width * brace.quantity;
    }

    // Calculate minimum floor area (at least one column must fit)
    const minColumnWidth = Math.min(
      ...braces.flatMap((b) => [b.width, b.length]),
    );
    const minFloorArea = minColumnWidth * usableLength;

    if (totalBraceArea < minFloorArea) {
      throw new BadRequestException(
        `Insufficient brace inventory: total brace area is ${totalBraceArea.toFixed(2)} m², ` +
        `but at least ${minFloorArea.toFixed(2)} m² is needed to fill one column. ` +
        `Add more braces to your inventory.`,
      );
    }

    // Check that at least one brace type has enough quantity for a single column
    let anyColumnFeasible = false;
    for (const brace of braces) {
      // Normal orientation
      const normalCount = Math.floor(usableLength / brace.length);
      if (normalCount > 0 && normalCount <= brace.quantity && brace.width <= usableWidth) {
        anyColumnFeasible = true;
        break;
      }
      // Rotated orientation
      const rotatedCount = Math.floor(usableLength / brace.width);
      if (rotatedCount > 0 && rotatedCount <= brace.quantity && brace.length <= usableWidth) {
        anyColumnFeasible = true;
        break;
      }
    }

    if (!anyColumnFeasible) {
      throw new BadRequestException(
        `Insufficient brace inventory: no single brace type has enough quantity to fill ` +
        `even one column (usable length: ${usableLength.toFixed(2)}m). ` +
        `Increase brace quantities or use a smaller tent.`,
      );
    }
  }

  /**
   * Generate all possible column types from available braces
   * Each brace can be placed normally or rotated 90 degrees
   */
  generateColumnTypes(braces: Brace[], usableLength: number): ColumnType[] {
    const columnTypes: ColumnType[] = [];

    for (const brace of braces) {
      // Normal orientation: width defines column width, length fills along tent length
      const normalBraceCount = Math.floor(usableLength / brace.length);
      if (normalBraceCount > 0) {
        columnTypes.push({
          braceLength: brace.length,
          braceWidth: brace.width,
          rotated: false,
          columnWidth: brace.width,
          fillLength: brace.length,
          braceCount: normalBraceCount,
          gap: usableLength - normalBraceCount * brace.length,
        });
      }

      // Rotated orientation: length defines column width, width fills along tent length
      const rotatedBraceCount = Math.floor(usableLength / brace.width);
      if (rotatedBraceCount > 0) {
        columnTypes.push({
          braceLength: brace.length,
          braceWidth: brace.width,
          rotated: true,
          columnWidth: brace.length,
          fillLength: brace.width,
          braceCount: rotatedBraceCount,
          gap: usableLength - rotatedBraceCount * brace.width,
        });
      }
    }

    // Sort by column width for consistent ordering
    return columnTypes.sort((a, b) => a.columnWidth - b.columnWidth);
  }

  /**
   * Count distinct brace types (unique brace sizes) in a column list
   */
  private countDistinctBraceTypes(columns: ColumnType[]): number {
    const seen = new Set<string>();
    for (const col of columns) {
      seen.add(`${col.braceLength}x${col.braceWidth}`);
    }
    return seen.size;
  }

  /**
   * Dynamic Programming search to find optimal column combinations
   * Uses discretization to centimeters for efficient state space
   *
   * Pareto comparison at each width is on totalGap only (fewer gaps = better).
   * distinctBraceTypes is tracked but not used for pruning during DP to keep
   * diverse solutions.
   */
  dpColumnSearch(columnTypes: ColumnType[], targetWidth: number, braces?: Brace[]): DPSolution[] {
    // Convert to centimeters for integer math
    const targetCm = Math.round(targetWidth / PRECISION);
    const maxSetbackIncreaseCm = Math.round(MAX_SETBACK_INCREASE / PRECISION);

    // State: Map from width (in cm) to Pareto set of solutions
    const states = new Map<number, DPSolution[]>();

    // Build brace quantity limits: key = "LxW", value = max quantity
    const braceQuantities: Record<string, number> = {};
    if (braces) {
      for (const brace of braces) {
        const key = `${brace.length}x${brace.width}`;
        braceQuantities[key] = (braceQuantities[key] || 0) + brace.quantity;
      }
    }

    // Initialize with empty solution. Start at one rail width because the layout
    // needs (numColumns + 1) rails: one before each column plus one after the last.
    const railCm = Math.round(RAIL_THICKNESS / PRECISION);
    states.set(railCm, [{
      setbackExcess: 0,
      totalGap: 0,
      columns: [],
      braceUsage: {},
      distinctBraceTypes: 0,
    }]);

    // Process states in order of increasing width
    const processedWidths = new Set<number>();
    const widthsToProcess = [railCm];

    while (widthsToProcess.length > 0) {
      const currentWidthCm = widthsToProcess.shift()!;

      if (processedWidths.has(currentWidthCm)) {
        continue;
      }
      processedWidths.add(currentWidthCm);

      const currentSolutions = states.get(currentWidthCm);
      if (!currentSolutions) continue;

      // Try adding each column type
      for (const columnType of columnTypes) {
        const columnWidthCm = Math.round(columnType.columnWidth / PRECISION);
        const railThicknessCm = Math.round(RAIL_THICKNESS / PRECISION);
        const newWidthCm = currentWidthCm + columnWidthCm + railThicknessCm;

        // Skip if we would exceed target width
        if (newWidthCm > targetCm) {
          continue;
        }

        // Create new solutions by extending current ones
        for (const solution of currentSolutions) {
          // Check brace quantity constraints
          if (braces && braces.length > 0) {
            const braceKey = `${columnType.braceLength}x${columnType.braceWidth}`;
            const currentUsage = (solution.braceUsage || {})[braceKey] || 0;
            const maxAvailable = braceQuantities[braceKey] || 0;
            if (currentUsage + columnType.braceCount > maxAvailable) {
              continue; // Skip: not enough braces in inventory
            }
          }

          // Update brace usage tracking
          const newBraceUsage = { ...(solution.braceUsage || {}) };
          const braceKey = `${columnType.braceLength}x${columnType.braceWidth}`;
          newBraceUsage[braceKey] = (newBraceUsage[braceKey] || 0) + columnType.braceCount;

          const newColumns = [...solution.columns, columnType];

          const newSolution: DPSolution = {
            setbackExcess: 0, // Will be set when we reach terminal state
            totalGap: solution.totalGap + columnType.gap,
            columns: newColumns,
            braceUsage: newBraceUsage,
            distinctBraceTypes: this.countDistinctBraceTypes(newColumns),
          };

          // Add to state map with Pareto pruning
          this.addSolutionToState(states, newWidthCm, newSolution);
        }

        // Add new width to process queue if not already processed
        if (!processedWidths.has(newWidthCm) && !widthsToProcess.includes(newWidthCm)) {
          widthsToProcess.push(newWidthCm);
        }
      }

      // Sort to process smaller widths first (BFS-like order)
      widthsToProcess.sort((a, b) => a - b);
    }

    // Collect terminal solutions (within acceptable setback range)
    const terminalSolutions: DPSolution[] = [];
    const minAcceptableWidthCm = targetCm - maxSetbackIncreaseCm;

    for (const [widthCm, solutions] of states.entries()) {
      if (widthCm >= minAcceptableWidthCm && widthCm <= targetCm) {
        const setbackExcessCm = targetCm - widthCm;
        for (const solution of solutions) {
          if (solution.columns.length === 0) continue; // skip empty solutions
          terminalSolutions.push({
            ...solution,
            setbackExcess: setbackExcessCm * PRECISION, // Convert back to meters
          });
        }
      }
    }

    return terminalSolutions;
  }

  /**
   * Add a solution to a state, maintaining Pareto optimality.
   * Comparison is on totalGap only -- we keep solutions with lowest gaps at each width.
   */
  private addSolutionToState(
    states: Map<number, DPSolution[]>,
    widthCm: number,
    newSolution: DPSolution,
  ): void {
    const existing = states.get(widthCm) || [];

    // Check if new solution is dominated (on totalGap, distinctBraceTypes, columns.length)
    const isDominated = existing.some(
      (s) => s.totalGap <= newSolution.totalGap &&
             s.distinctBraceTypes <= newSolution.distinctBraceTypes &&
             s.columns.length <= newSolution.columns.length,
    );

    if (isDominated) {
      return;
    }

    // Remove solutions dominated by the new one
    const nonDominated = existing.filter(
      (s) => !(newSolution.totalGap <= s.totalGap &&
               newSolution.distinctBraceTypes <= s.distinctBraceTypes &&
               newSolution.columns.length <= s.columns.length),
    );

    // Limit the Pareto set size to prevent memory explosion
    const MAX_PARETO_SIZE = 50;
    nonDominated.push(newSolution);

    if (nonDominated.length > MAX_PARETO_SIZE) {
      // Keep solutions with best total gap
      nonDominated.sort((a, b) => a.totalGap - b.totalGap);
      states.set(widthCm, nonDominated.slice(0, MAX_PARETO_SIZE));
    } else {
      states.set(widthCm, nonDominated);
    }
  }

  /**
   * Step 2.5: Open-End Optimization (Setback Sweep)
   *
   * For each DP solution, sweep usable_length from min to max
   * (corresponding to MAX_SETBACK down to MIN_SETBACK on each side)
   * and find the usable_length that minimizes total gap across all columns.
   */
  private optimizeOpenEndSetbacks(solutions: DPSolution[], railLength: number): DPSolution[] {
    const minUsableLength = railLength - 2 * MAX_SETBACK;
    const maxUsableLength = railLength - 2 * MIN_SETBACK;

    if (minUsableLength <= 0) {
      // Rail length too small for max setback; clamp
      return solutions;
    }

    return solutions.map((solution) => {
      let bestTotalGap = Infinity;
      let bestUsableLength = maxUsableLength;

      // Sweep in 1cm steps
      const steps = Math.round((maxUsableLength - minUsableLength) / PRECISION);
      for (let i = 0; i <= steps; i++) {
        const usableLen = minUsableLength + i * PRECISION;
        let totalGap = 0;
        let allColumnsValid = true;

        for (const col of solution.columns) {
          const n = Math.floor(usableLen / col.fillLength);
          if (n < 1) {
            allColumnsValid = false;
            break;
          }
          const colGap = usableLen - n * col.fillLength;
          if (colGap > MAX_COLUMN_GAP + 0.001) {
            allColumnsValid = false;
            break;
          }
          totalGap += colGap;
        }

        if (allColumnsValid && totalGap < bestTotalGap - 0.0001) {
          bestTotalGap = totalGap;
          bestUsableLength = usableLen;
        }
      }

      // Calculate open-end setbacks: split remainder across both sides
      const totalOpenSetback = railLength - bestUsableLength;
      // Split equally (each side must be in [MIN_SETBACK, MAX_SETBACK])
      const openSetbackEach = totalOpenSetback / 2;

      // Recompute brace counts for each column at the optimized length
      const updatedColumns = solution.columns.map((col) => {
        const n = Math.floor(bestUsableLength / col.fillLength);
        const gap = bestUsableLength - n * col.fillLength;
        return {
          ...col,
          braceCount: n,
          gap,
        };
      });

      // Recompute brace usage for the updated columns
      const newBraceUsage: Record<string, number> = {};
      for (const col of updatedColumns) {
        const key = `${col.braceLength}x${col.braceWidth}`;
        newBraceUsage[key] = (newBraceUsage[key] || 0) + col.braceCount;
      }

      return {
        ...solution,
        columns: updatedColumns,
        totalGap: bestTotalGap,
        optimizedUsableLength: bestUsableLength,
        openEndSetbackStart: openSetbackEach,
        openEndSetbackEnd: openSetbackEach,
        braceUsage: newBraceUsage,
      };
    });
  }

  /**
   * Select named scenarios from the full solution pool.
   * Each criterion does a simple reduce over ALL solutions — no Pareto filtering.
   * Returns up to 10 unique solutions, minimum 6 if enough exist.
   */
  selectNamedScenarios(solutions: DPSolution[]): DPSolution[] {
    if (solutions.length === 0) {
      return [];
    }

    if (solutions.length === 1) {
      return [solutions[0]];
    }

    const selected: DPSolution[] = [];
    const selectedSet = new Set<DPSolution>();

    const addUnique = (sol: DPSolution) => {
      if (!selectedSet.has(sol)) {
        selectedSet.add(sol);
        selected.push(sol);
      }
    };

    // 1. Best Width Fit: min setbackExcess, tie-break: min totalGap
    const bestWidthFit = solutions.reduce((best, cur) => {
      if (cur.setbackExcess < best.setbackExcess) return cur;
      if (cur.setbackExcess === best.setbackExcess && cur.totalGap < best.totalGap) return cur;
      return best;
    });
    addUnique(bestWidthFit);

    // 2. Minimum Gaps: min totalGap, tie-break: min setbackExcess
    const minGaps = solutions.reduce((best, cur) => {
      if (cur.totalGap < best.totalGap) return cur;
      if (cur.totalGap === best.totalGap && cur.setbackExcess < best.setbackExcess) return cur;
      return best;
    });
    addUnique(minGaps);

    // 3. Least Brace Kinds: min distinctBraceTypes, tie-break: min totalGap
    const leastKinds = solutions.reduce((best, cur) => {
      if (cur.distinctBraceTypes < best.distinctBraceTypes) return cur;
      if (cur.distinctBraceTypes === best.distinctBraceTypes && cur.totalGap < best.totalGap) return cur;
      return best;
    });
    addUnique(leastKinds);

    // 4. Least Rails: min columns.length, tie-break: min totalGap
    const leastRails = solutions.reduce((best, cur) => {
      if (cur.columns.length < best.columns.length) return cur;
      if (cur.columns.length === best.columns.length && cur.totalGap < best.totalGap) return cur;
      return best;
    });
    addUnique(leastRails);

    // 5. Least Braces: min total brace count, tie-break: min totalGap
    const totalBraceCount = (sol: DPSolution): number =>
      sol.columns.reduce((sum, col) => sum + col.braceCount, 0);

    const leastBraces = solutions.reduce((best, cur) => {
      if (totalBraceCount(cur) < totalBraceCount(best)) return cur;
      if (totalBraceCount(cur) === totalBraceCount(best) && cur.totalGap < best.totalGap) return cur;
      return best;
    });
    addUnique(leastBraces);

    // 6. Biggest Braces: max coverage by largest brace type, tie-break: min totalGap
    const largestBraceCoverage = (sol: DPSolution): number => {
      let maxArea = 0;
      let maxCoverage = 0;
      for (const col of sol.columns) {
        const area = col.braceLength * col.braceWidth;
        const coverage = area * col.braceCount;
        if (area > maxArea || (area === maxArea && coverage > maxCoverage)) {
          maxArea = area;
          maxCoverage = coverage;
        }
      }
      return maxCoverage;
    };
    const biggestBraces = solutions.reduce((best, cur) => {
      const bestCov = largestBraceCoverage(best);
      const curCov = largestBraceCoverage(cur);
      if (curCov > bestCov) return cur;
      if (curCov === bestCov && cur.totalGap < best.totalGap) return cur;
      return best;
    });
    addUnique(biggestBraces);

    // 7. Balanced: knee point (closest to origin in normalized setback × gap space)
    if (solutions.length > 2) {
      const maxSetback = Math.max(...solutions.map((s) => s.setbackExcess));
      const minSetback = Math.min(...solutions.map((s) => s.setbackExcess));
      const maxGap = Math.max(...solutions.map((s) => s.totalGap));
      const minGap = Math.min(...solutions.map((s) => s.totalGap));

      const setbackRange = maxSetback - minSetback || 1;
      const gapRange = maxGap - minGap || 1;

      let balanced: DPSolution | null = null;
      let minDistance = Infinity;

      for (const sol of solutions) {
        const normSetback = (sol.setbackExcess - minSetback) / setbackRange;
        const normGap = (sol.totalGap - minGap) / gapRange;
        const distance = Math.sqrt(normSetback * normSetback + normGap * normGap);
        if (distance < minDistance) {
          minDistance = distance;
          balanced = sol;
        }
      }

      if (balanced) {
        addUnique(balanced);
      }
    }

    // 8-10. Balanced 2-4: evenly-spaced from remaining pool sorted by totalGap
    const remaining = solutions
      .filter((s) => !selectedSet.has(s))
      .sort((a, b) => a.totalGap - b.totalGap);

    if (remaining.length > 0) {
      const numSlots = Math.min(3, remaining.length);
      for (let i = 0; i < numSlots; i++) {
        const idx = Math.round((i * (remaining.length - 1)) / Math.max(numSlots - 1, 1));
        addUnique(remaining[idx]);
      }
    }

    // Fill to 6 if needed: add remaining sorted by totalGap
    if (selected.length < 6) {
      const leftover = solutions
        .filter((s) => !selectedSet.has(s))
        .sort((a, b) => a.totalGap - b.totalGap);
      for (const sol of leftover) {
        if (selected.length >= 6) break;
        addUnique(sol);
      }
    }

    return selected.slice(0, 10);
  }

  /**
   * Construct a complete scenario from a solution
   */
  private constructScenario(
    solution: DPSolution,
    name: string,
    tent: TentDimensions,
    railInventory: Rail[],
  ): Scenario {
    // Calculate actual width setback
    // Total width consumed = sum of column widths + (numColumns + 1) rails
    const numColumns = solution.columns.length;
    const totalColumnWidth = solution.columns.reduce((sum, col) => sum + col.columnWidth, 0);
    const totalRailWidth = (numColumns + 1) * RAIL_THICKNESS;
    const usableWidth = tent.width - 2 * MIN_SETBACK;
    const additionalSetback = (usableWidth - totalColumnWidth - totalRailWidth) / 2;
    const actualSetback = MIN_SETBACK + Math.max(0, additionalSetback);

    // Use the optimized usable length from the open-end sweep
    const usableLength = solution.optimizedUsableLength ?? (tent.length - 2 * MIN_SETBACK);
    const openEndSetbackStart = solution.openEndSetbackStart ?? MIN_SETBACK;
    const openEndSetbackEnd = solution.openEndSetbackEnd ?? MIN_SETBACK;

    // Sort columns to group same brace type + orientation together for cleaner visualization
    // Sort by: 1) brace type (length × width), 2) orientation (rotated), 3) original order (stable)
    const sortedColumns = [...solution.columns].sort((a, b) => {
      // Primary: Group by brace type (length × width)
      const keyA = `${a.braceLength}×${a.braceWidth}`;
      const keyB = `${b.braceLength}×${b.braceWidth}`;
      if (keyA !== keyB) {
        return keyA.localeCompare(keyB);
      }
      // Secondary: Group by orientation (non-rotated first, then rotated)
      if (a.rotated !== b.rotated) {
        return a.rotated ? 1 : -1;
      }
      // Tertiary: Maintain stable order for same type + orientation
      return 0;
    });

    // Place columns with rail gaps between them
    const columns: Column[] = [];
    let position = actualSetback + RAIL_THICKNESS; // Start after first rail

    for (const columnType of sortedColumns) {
      columns.push({
        columnType,
        position,
      });
      position += columnType.columnWidth + RAIL_THICKNESS; // Column + rail after it
    }

    // Construct rails
    const rails = this.constructRails(usableLength, railInventory);

    // Calculate total gap (linear gap sum, already computed by DP + sweep)
    const totalGap = solution.columns.reduce(
      (sum, col) => sum + col.gap * col.columnWidth,
      0,
    );

    return {
      name,
      setback: Math.round(actualSetback * 1000) / 1000,
      openEndSetbackStart: Math.round(openEndSetbackStart * 1000) / 1000,
      openEndSetbackEnd: Math.round(openEndSetbackEnd * 1000) / 1000,
      totalGap: Math.round(totalGap * 1000) / 1000,
      columns,
      rails,
      usableWidth: Math.round(totalColumnWidth * 1000) / 1000,
      usableLength: Math.round(usableLength * 1000) / 1000,
      tentLength: tent.length,
      tentWidth: tent.width,
      distinctBraceTypes: solution.distinctBraceTypes,
    };
  }

  /**
   * Construct rail segments to span the usable length
   * Uses greedy algorithm: longest available rails first
   */
  constructRails(usableLength: number, railInventory: Rail[]): RailSegment[][] {
    // Sort rails by length (descending) for greedy selection
    const sortedRails = [...railInventory].sort((a, b) => b.length - a.length);

    // Construct two rails (one for each side)
    const rails: RailSegment[][] = [];

    for (let i = 0; i < 2; i++) {
      const railSegments: RailSegment[] = [];
      let remainingLength = usableLength;
      let position = 0;

      // Track rail usage for this construction
      const railUsage = new Map<number, number>(
        sortedRails.map((r) => [r.length, r.quantity]),
      );

      while (remainingLength > PRECISION) {
        // Find longest rail that fits and is available
        let selectedRail: Rail | null = null;

        for (const rail of sortedRails) {
          const available = railUsage.get(rail.length) || 0;
          if (available > 0 && rail.length <= remainingLength + PRECISION) {
            selectedRail = rail;
            break;
          }
        }

        if (!selectedRail) {
          // If no exact fit, use longest available rail
          // (rails can extend beyond usable area in practice)
          for (const rail of sortedRails) {
            const available = railUsage.get(rail.length) || 0;
            if (available > 0) {
              selectedRail = rail;
              break;
            }
          }
        }

        if (!selectedRail) {
          // No more rails available, break
          break;
        }

        // Use this rail
        const segmentLength = Math.min(selectedRail.length, remainingLength);
        railSegments.push({
          length: Math.round(segmentLength * 1000) / 1000,
          position: Math.round(position * 1000) / 1000,
        });

        // Update tracking
        const currentUsage = railUsage.get(selectedRail.length) || 0;
        if (currentUsage !== Infinity) {
          railUsage.set(selectedRail.length, currentUsage - 1);
        }

        position += segmentLength;
        remainingLength -= segmentLength;
      }

      rails.push(railSegments);
    }

    return rails;
  }
}
