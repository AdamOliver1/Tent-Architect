import { Injectable, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import {
  TentDimensions,
  Brace,
  Rail,
  BracePlacement,
  ColumnType,
  Column,
  RailSegment,
  Scenario,
  DPSolution,
} from '../shared/types';
import { CalculateRequestDto, CalculateResponseDto } from './dto';

/** Rail thickness in meters (5cm) - exported for potential use */
export const RAIL_THICKNESS = 0.05;

/** Default minimum setback from tent edges in meters (8cm) */
const DEFAULT_MIN_SETBACK = 0.08;

/** Default maximum setback from tent edges in meters (25cm) */
const DEFAULT_MAX_SETBACK = 0.25;

/** Precision for discretization in meters (1cm) */
const PRECISION = 0.01;

/** Default maximum allowed gap per column in meters (39cm) */
const DEFAULT_MAX_COLUMN_GAP = 0.39;

/** Resolved algorithm constraints with defaults applied */
interface ResolvedConstraints {
  minSetback: number;
  maxSetback: number;
  maxSetbackIncrease: number;
  maxColumnGap: number;
}

/** Maximum scenarios to return */
const MAX_SCENARIOS = 20;

@Injectable()
export class CalculationService {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Resolve user-provided constraints with defaults
   */
  private resolveConstraints(input?: { minSetback?: number; maxSetback?: number; maxColumnGap?: number }): ResolvedConstraints {
    const minSetback = input?.minSetback ?? DEFAULT_MIN_SETBACK;
    const maxSetback = input?.maxSetback ?? DEFAULT_MAX_SETBACK;
    const maxColumnGap = input?.maxColumnGap ?? DEFAULT_MAX_COLUMN_GAP;

    if (minSetback > maxSetback) {
      throw new BadRequestException('minSetback cannot be greater than maxSetback');
    }

    return {
      minSetback,
      maxSetback,
      maxSetbackIncrease: maxSetback - minSetback,
      maxColumnGap,
    };
  }

  /**
   * Main calculation endpoint
   * Tries both orientations (which dimension becomes rail direction vs column direction)
   * and returns the best scenarios from all possibilities
   */
  calculate(request: CalculateRequestDto): CalculateResponseDto {
    const { tent } = request;

    // Resolve constraints with defaults
    const c = this.resolveConstraints(request.constraints);

    // Validate tent dimensions
    this.validateTentDimensions(tent, c);

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
      const solutions1 = this.calculateForOrientation(tent.length, tent.width, inventory, c);
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
        const solutions2 = this.calculateForOrientation(tent.width, tent.length, inventory, c);
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
    const scenarios = selectedSolutions.map((sol) => {
      const tagged = taggedSolutions.find((t) => t.solution === sol)!;
      const name = (sol as any).__scenarioName || 'Scenario';
      const scenario = this.constructScenario(
        sol,
        name,
        tagged.orientedTent,
        inventory.rails,
        c,
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
    c: ResolvedConstraints,
  ): DPSolution[] {
    // Calculate usable dimensions with minimum setback
    const usableLength = railLength - 2 * c.minSetback;
    const usableWidth = columnSpan - 2 * c.minSetback;

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
    const solutions = this.dpColumnSearch(columnTypes, usableWidth, inventory.braces, c);

    if (solutions.length === 0) {
      throw new BadRequestException(
        'No valid floor plan found. Insufficient inventory for this orientation.',
      );
    }

    // Step 2.5: Open-end optimization (setback sweep) for each solution
    const optimizedSolutions = this.optimizeOpenEndSetbacks(solutions, railLength, c);

    // Filter invalid solutions (any setback out of [minSetback, maxSetback])
    const validSolutions = optimizedSolutions.filter((sol) => {
      const widthSetback = c.minSetback + sol.setbackExcess / 2;
      if (widthSetback < c.minSetback - 0.001 || widthSetback > c.maxSetback + 0.001) {
        return false;
      }
      if ((sol.openEndSetbackStart ?? 0) < c.minSetback - 0.001 ||
          (sol.openEndSetbackStart ?? 0) > c.maxSetback + 0.001) {
        return false;
      }
      if ((sol.openEndSetbackEnd ?? 0) < c.minSetback - 0.001 ||
          (sol.openEndSetbackEnd ?? 0) > c.maxSetback + 0.001) {
        return false;
      }
      return true;
    });

    // Filter solutions where any column gap exceeds maxColumnGap
    const gapFilteredSolutions = validSolutions.filter((sol) =>
      sol.columns.every((col) => col.gap <= c.maxColumnGap + 0.001),
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
  private validateTentDimensions(tent: TentDimensions, c: ResolvedConstraints): void {
    if (tent.length <= 0 || tent.width <= 0) {
      throw new BadRequestException('Tent dimensions must be positive');
    }
    if (tent.length < 2 * c.minSetback || tent.width < 2 * c.minSetback) {
      throw new BadRequestException(
        `Tent dimensions must be at least ${2 * c.minSetback}m to accommodate minimum setback`,
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

    // Generate mixed column types for groups sharing the same columnWidth.
    // Then prune pure types that are strictly dominated by the mixed type
    // (worse gap AND more braces). This prevents the DP from choosing columns
    // with many small braces when a mixed column using larger braces is better.
    const byWidth = new Map<number, ColumnType[]>();
    for (const ct of columnTypes) {
      const key = Math.round(ct.columnWidth * 1000); // avoid float key issues
      const group = byWidth.get(key) || [];
      group.push(ct);
      byWidth.set(key, group);
    }

    // Track which pure types to remove (dominated by mixed)
    const toRemove = new Set<ColumnType>();

    for (const [, group] of byWidth) {
      // Only create mixed if there are 2+ distinct fill lengths
      const distinctFills = new Set(group.map((ct) => ct.fillLength));
      if (distinctFills.size < 2) continue;

      // Best pure gap and its brace count for this columnWidth
      const bestPureGap = Math.min(...group.map((ct) => ct.gap));
      const bestPureBraceCount = Math.min(
        ...group.filter((ct) => Math.abs(ct.gap - bestPureGap) < 0.001).map((ct) => ct.braceCount),
      );

      // Build fill options from the group
      const fillOptions = group.map((ct) => ({
        fillLength: ct.fillLength,
        braceLength: ct.braceLength,
        braceWidth: ct.braceWidth,
        rotated: ct.rotated,
      }));

      const usableLengthCm = Math.round(usableLength / PRECISION);
      const { placements, gap: mixedGap } = this.solveMixedFill(fillOptions, usableLengthCm);

      if (placements.length <= 1) continue;

      const totalBraceCount = placements.reduce((sum, p) => sum + p.count, 0);

      // Add mixed column if it improves gap OR uses significantly fewer braces at same gap
      const gapImproves = mixedGap < bestPureGap - 0.001;
      const samGapFewerBraces = Math.abs(mixedGap - bestPureGap) < 0.001
        && totalBraceCount < bestPureBraceCount;

      if (gapImproves || samGapFewerBraces) {
        // Use the dominant (most-used) brace for backward-compat fields
        const dominant = placements.reduce((best, p) => p.count > best.count ? p : best);

        const mixedType: ColumnType = {
          braceLength: dominant.braceLength,
          braceWidth: dominant.braceWidth,
          rotated: dominant.rotated,
          columnWidth: group[0].columnWidth,
          fillLength: dominant.fillLength,
          braceCount: totalBraceCount,
          gap: mixedGap,
          mixed: true,
          bracePlacements: placements,
        };

        columnTypes.push(mixedType);

        // Prune dominated pure types: remove pure types that have
        // worse-or-equal gap AND more braces than the mixed type.
        // Always bigger braces are preferred — 49×0.4m is never better than
        // 19×1.0m + 2×0.4m when the mixed type achieves a better gap too.
        for (const pure of group) {
          if (pure.gap >= mixedGap - 0.001 && pure.braceCount > totalBraceCount) {
            toRemove.add(pure);
          }
        }
      }
    }

    // Remove dominated pure types
    const filtered = toRemove.size > 0
      ? columnTypes.filter((ct) => !toRemove.has(ct))
      : columnTypes;

    // Sort by column width for consistent ordering
    return filtered.sort((a, b) => a.columnWidth - b.columnWidth);
  }

  /**
   * Solve mixed fill: find the combination of brace types (sharing the same columnWidth)
   * that maximizes total fill without exceeding the target length.
   * Uses bounded knapsack DP in centimeter units.
   *
   * @param fillOptions - Available brace types for this column width
   * @param usableLengthCm - Target usable length in centimeters (integer)
   * @param maxCountPerOption - Max braces per option (e.g., from inventory). Defaults to usableLength/fillLength.
   * @returns Object with bracePlacements and resulting gap in meters
   */
  solveMixedFill(
    fillOptions: { fillLength: number; braceLength: number; braceWidth: number; rotated: boolean }[],
    usableLengthCm: number,
    maxCountPerOption?: number[],
  ): { placements: BracePlacement[]; gap: number } {
    const targetCm = Math.round(usableLengthCm);
    if (targetCm <= 0 || fillOptions.length === 0) {
      return { placements: [], gap: usableLengthCm * PRECISION };
    }

    // Sort options by descending fillLength so the DP processes largest braces first.
    // This ensures that when two combinations achieve the same fill, the one using
    // larger (fewer) braces wins the tie.
    const sortedIndices = fillOptions
      .map((_, i) => i)
      .sort((a, b) => {
        const fa = Math.round(fillOptions[a].fillLength / PRECISION);
        const fb = Math.round(fillOptions[b].fillLength / PRECISION);
        return fb - fa; // largest first
      });

    // Convert fill lengths to cm
    const optionsCm = fillOptions.map((opt) => Math.round(opt.fillLength / PRECISION));

    // Compute max count for each option
    const maxCounts = fillOptions.map((_, i) => {
      if (maxCountPerOption && maxCountPerOption[i] !== undefined) {
        return Math.min(maxCountPerOption[i], Math.floor(targetCm / optionsCm[i]));
      }
      return Math.floor(targetCm / optionsCm[i]);
    });

    // DP arrays: dpFill[w] = max fill achievable, dpCount[w] = min braces for that fill
    const dpFill = new Int32Array(targetCm + 1).fill(0);
    const dpCount = new Int32Array(targetCm + 1).fill(0);
    // Track choices for backtracking
    const choice: { optIdx: number; count: number }[] = new Array(targetCm + 1).fill(null).map(() => ({ optIdx: -1, count: 0 }));

    // Process options in descending fillLength order
    for (const i of sortedIndices) {
      const fillCm = optionsCm[i];
      if (fillCm <= 0) continue;
      const maxK = maxCounts[i];

      // Bounded knapsack with binary splitting
      let remaining = maxK;
      let multiplier = 1;
      while (remaining > 0) {
        const batch = Math.min(multiplier, remaining);
        const batchFill = batch * fillCm;

        for (let w = targetCm; w >= batchFill; w--) {
          const newFill = dpFill[w - batchFill] + batchFill;
          const newCount = dpCount[w - batchFill] + batch;
          // Primary: maximize fill. Tie-break: minimize brace count (prefer larger braces).
          if (newFill > dpFill[w] || (newFill === dpFill[w] && newCount < dpCount[w])) {
            dpFill[w] = newFill;
            dpCount[w] = newCount;
            choice[w] = { optIdx: i, count: batch };
          }
        }

        remaining -= batch;
        multiplier *= 2;
      }
    }

    // Backtrack to find actual counts
    const counts = new Array(fillOptions.length).fill(0);
    let w = targetCm;
    while (w > 0 && choice[w].optIdx >= 0) {
      const { optIdx, count } = choice[w];
      counts[optIdx] += count;
      w -= count * optionsCm[optIdx];
    }

    // Build placements (only include options with count > 0)
    const placements: BracePlacement[] = [];
    for (let i = 0; i < fillOptions.length; i++) {
      if (counts[i] > 0) {
        placements.push({
          braceLength: fillOptions[i].braceLength,
          braceWidth: fillOptions[i].braceWidth,
          rotated: fillOptions[i].rotated,
          fillLength: fillOptions[i].fillLength,
          count: counts[i],
        });
      }
    }

    // Sort by fillLength descending (primary/largest braces first)
    placements.sort((a, b) => b.fillLength - a.fillLength);

    const totalFillCm = dpFill[targetCm];
    const gapM = (targetCm - totalFillCm) * PRECISION;

    return { placements, gap: Math.max(0, gapM) };
  }

  /**
   * Count distinct brace types (unique brace sizes) in a column list
   */
  private countDistinctBraceTypes(columns: ColumnType[]): number {
    const seen = new Set<string>();
    for (const col of columns) {
      if (col.bracePlacements) {
        for (const bp of col.bracePlacements) {
          seen.add(`${bp.braceLength}x${bp.braceWidth}`);
        }
      } else {
        seen.add(`${col.braceLength}x${col.braceWidth}`);
      }
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
  dpColumnSearch(columnTypes: ColumnType[], targetWidth: number, braces?: Brace[], c?: ResolvedConstraints): DPSolution[] {
    // Convert to centimeters for integer math
    const targetCm = Math.round(targetWidth / PRECISION);
    const maxSetbackIncrease = c?.maxSetbackIncrease ?? (DEFAULT_MAX_SETBACK - DEFAULT_MIN_SETBACK);
    const maxSetbackIncreaseCm = Math.round(maxSetbackIncrease / PRECISION);

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
            if (columnType.bracePlacements) {
              // Mixed column: check each brace type in placements
              let canFit = true;
              for (const bp of columnType.bracePlacements) {
                const bpKey = `${bp.braceLength}x${bp.braceWidth}`;
                const currentUsage = (solution.braceUsage || {})[bpKey] || 0;
                const maxAvailable = braceQuantities[bpKey] || 0;
                if (currentUsage + bp.count > maxAvailable) {
                  canFit = false;
                  break;
                }
              }
              if (!canFit) continue;
            } else {
              const braceKey = `${columnType.braceLength}x${columnType.braceWidth}`;
              const currentUsage = (solution.braceUsage || {})[braceKey] || 0;
              const maxAvailable = braceQuantities[braceKey] || 0;
              if (currentUsage + columnType.braceCount > maxAvailable) {
                continue; // Skip: not enough braces in inventory
              }
            }
          }

          // Update brace usage tracking
          const newBraceUsage = { ...(solution.braceUsage || {}) };
          if (columnType.bracePlacements) {
            for (const bp of columnType.bracePlacements) {
              const bpKey = `${bp.braceLength}x${bp.braceWidth}`;
              newBraceUsage[bpKey] = (newBraceUsage[bpKey] || 0) + bp.count;
            }
          } else {
            const braceKey = `${columnType.braceLength}x${columnType.braceWidth}`;
            newBraceUsage[braceKey] = (newBraceUsage[braceKey] || 0) + columnType.braceCount;
          }

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
  private optimizeOpenEndSetbacks(solutions: DPSolution[], railLength: number, c: ResolvedConstraints): DPSolution[] {
    const minUsableLength = railLength - 2 * c.maxSetback;
    const maxUsableLength = railLength - 2 * c.minSetback;

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
        const usableLenCm = Math.round(usableLen / PRECISION);
        let totalGap = 0;
        let allColumnsValid = true;

        for (const col of solution.columns) {
          if (col.mixed && col.bracePlacements) {
            // Re-solve knapsack for mixed columns at this usable length
            const fillOptions = col.bracePlacements.map((bp) => ({
              fillLength: bp.fillLength,
              braceLength: bp.braceLength,
              braceWidth: bp.braceWidth,
              rotated: bp.rotated,
            }));
            const { gap: mixedGap } = this.solveMixedFill(fillOptions, usableLenCm);
            if (mixedGap > c.maxColumnGap + 0.001) {
              allColumnsValid = false;
              break;
            }
            totalGap += mixedGap;
          } else {
            const n = Math.floor(usableLen / col.fillLength);
            if (n < 1) {
              allColumnsValid = false;
              break;
            }
            const colGap = usableLen - n * col.fillLength;
            if (colGap > c.maxColumnGap + 0.001) {
              allColumnsValid = false;
              break;
            }
            totalGap += colGap;
          }
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
      const bestUsableLenCm = Math.round(bestUsableLength / PRECISION);
      const updatedColumns = solution.columns.map((col) => {
        if (col.mixed && col.bracePlacements) {
          // Re-solve knapsack for mixed columns
          const fillOptions = col.bracePlacements.map((bp) => ({
            fillLength: bp.fillLength,
            braceLength: bp.braceLength,
            braceWidth: bp.braceWidth,
            rotated: bp.rotated,
          }));
          const { placements, gap: mixedGap } = this.solveMixedFill(fillOptions, bestUsableLenCm);
          const totalCount = placements.reduce((sum, p) => sum + p.count, 0);
          // Determine dominant brace for backward-compat fields
          const dominant = placements.length > 0
            ? placements.reduce((best, p) => p.count > best.count ? p : best)
            : col.bracePlacements[0];
          return {
            ...col,
            braceLength: dominant.braceLength,
            braceWidth: dominant.braceWidth,
            rotated: dominant.rotated,
            fillLength: dominant.fillLength,
            braceCount: totalCount,
            gap: mixedGap,
            bracePlacements: placements,
          };
        } else {
          const n = Math.floor(bestUsableLength / col.fillLength);
          const gap = bestUsableLength - n * col.fillLength;
          return {
            ...col,
            braceCount: n,
            gap,
          };
        }
      });

      // Recompute brace usage for the updated columns
      const newBraceUsage: Record<string, number> = {};
      for (const col of updatedColumns) {
        if (col.bracePlacements) {
          for (const bp of col.bracePlacements) {
            const key = `${bp.braceLength}x${bp.braceWidth}`;
            newBraceUsage[key] = (newBraceUsage[key] || 0) + bp.count;
          }
        } else {
          const key = `${col.braceLength}x${col.braceWidth}`;
          newBraceUsage[key] = (newBraceUsage[key] || 0) + col.braceCount;
        }
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
   * Returns up to MAX_SCENARIOS unique solutions with descriptive names.
   * Includes variants for key categories (Biggest Braces, Least Rails, etc.)
   * to give the user more choices.
   */
  selectNamedScenarios(solutions: DPSolution[]): DPSolution[] {
    if (solutions.length === 0) {
      return [];
    }

    if (solutions.length === 1) {
      return [solutions[0]];
    }

    const selected: { sol: DPSolution; name: string }[] = [];
    const selectedSet = new Set<DPSolution>();

    const addUnique = (sol: DPSolution, name: string): boolean => {
      if (!selectedSet.has(sol)) {
        selectedSet.add(sol);
        selected.push({ sol, name });
        return true;
      }
      return false;
    };

    // ── Helper: compute brace coverage properly (handles mixed columns) ──
    const totalBraceCount = (sol: DPSolution): number =>
      sol.columns.reduce((sum, col) => sum + col.braceCount, 0);

    // Total area covered by largest brace size across ALL columns in a solution
    const totalLargestBraceCoverage = (sol: DPSolution): { maxArea: number; totalCoverage: number } => {
      // Find largest brace area
      let maxArea = 0;
      for (const col of sol.columns) {
        if (col.bracePlacements) {
          for (const bp of col.bracePlacements) {
            maxArea = Math.max(maxArea, bp.braceLength * bp.braceWidth);
          }
        } else {
          maxArea = Math.max(maxArea, col.braceLength * col.braceWidth);
        }
      }
      // Sum coverage of that brace size across all columns
      let totalCoverage = 0;
      for (const col of sol.columns) {
        if (col.bracePlacements) {
          for (const bp of col.bracePlacements) {
            if (Math.abs(bp.braceLength * bp.braceWidth - maxArea) < 0.001) {
              totalCoverage += bp.braceLength * bp.braceWidth * bp.count;
            }
          }
        } else {
          if (Math.abs(col.braceLength * col.braceWidth - maxArea) < 0.001) {
            totalCoverage += col.braceLength * col.braceWidth * col.braceCount;
          }
        }
      }
      return { maxArea, totalCoverage };
    };

    // ═══════════════════════════════════════════════════
    // 1. CORE SCENARIOS (always included, one each)
    // ═══════════════════════════════════════════════════

    // 1. Best Width Fit: min setbackExcess, tie-break: min totalGap
    const bestWidthFit = solutions.reduce((best, cur) => {
      if (cur.setbackExcess < best.setbackExcess) return cur;
      if (cur.setbackExcess === best.setbackExcess && cur.totalGap < best.totalGap) return cur;
      return best;
    });
    addUnique(bestWidthFit, 'Best Width Fit');

    // 2. Least Brace Kinds: min distinctBraceTypes, tie-break: min totalGap
    const leastKinds = solutions.reduce((best, cur) => {
      if (cur.distinctBraceTypes < best.distinctBraceTypes) return cur;
      if (cur.distinctBraceTypes === best.distinctBraceTypes && cur.totalGap < best.totalGap) return cur;
      return best;
    });
    addUnique(leastKinds, 'Least Brace Kinds');

    // ═══════════════════════════════════════════════════
    // 2. VARIANTS — multiple options for key categories
    // ═══════════════════════════════════════════════════

    // Minimum Gaps variants: solutions sorted by totalGap (ascending)
    // Guarantees at least one scenario explicitly named "Minimum Gaps"
    const sortedByGap = [...solutions].sort((a, b) => {
      if (Math.abs(a.totalGap - b.totalGap) > 0.001) return a.totalGap - b.totalGap;
      return a.setbackExcess - b.setbackExcess;
    });
    for (let i = 0; i < Math.min(3, sortedByGap.length); i++) {
      const suffix = i === 0 ? '' : ` ${i + 1}`;
      addUnique(sortedByGap[i], `Minimum Gaps${suffix}`);
    }

    // Least Rails variants: solutions with fewest columns, sorted by totalGap
    const minColCount = Math.min(...solutions.map((s) => s.columns.length));
    const leastRailsCandidates = solutions
      .filter((s) => s.columns.length <= minColCount + 1) // include +1 column variants too
      .sort((a, b) => {
        if (a.columns.length !== b.columns.length) return a.columns.length - b.columns.length;
        return a.totalGap - b.totalGap;
      });
    for (let i = 0; i < Math.min(3, leastRailsCandidates.length); i++) {
      const suffix = i === 0 ? '' : ` ${i + 1}`;
      addUnique(leastRailsCandidates[i], `Least Rails${suffix}`);
    }

    // Least Braces variants: solutions with fewest total braces
    const sortedByBraceCount = [...solutions].sort((a, b) => {
      const diff = totalBraceCount(a) - totalBraceCount(b);
      if (diff !== 0) return diff;
      return a.totalGap - b.totalGap;
    });
    for (let i = 0; i < Math.min(2, sortedByBraceCount.length); i++) {
      const suffix = i === 0 ? '' : ` ${i + 1}`;
      addUnique(sortedByBraceCount[i], `Least Braces${suffix}`);
    }

    // Biggest Braces variants: solutions that maximize coverage by largest brace
    const sortedByBiggestBrace = [...solutions].sort((a, b) => {
      const aCov = totalLargestBraceCoverage(a);
      const bCov = totalLargestBraceCoverage(b);
      // Primary: largest brace area
      if (Math.abs(aCov.maxArea - bCov.maxArea) > 0.001) return bCov.maxArea - aCov.maxArea;
      // Secondary: more coverage by that brace
      if (Math.abs(aCov.totalCoverage - bCov.totalCoverage) > 0.01) return bCov.totalCoverage - aCov.totalCoverage;
      // Tertiary: lower gap
      return a.totalGap - b.totalGap;
    });
    for (let i = 0; i < Math.min(3, sortedByBiggestBrace.length); i++) {
      const suffix = i === 0 ? '' : ` ${i + 1}`;
      addUnique(sortedByBiggestBrace[i], `Biggest Braces${suffix}`);
    }

    // ═══════════════════════════════════════════════════
    // 3. BALANCED — knee-point and spread from remaining
    // ═══════════════════════════════════════════════════

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
        addUnique(balanced, 'Balanced');
      }
    }

    // ═══════════════════════════════════════════════════
    // 4. FILL remaining slots with diverse solutions
    // ═══════════════════════════════════════════════════

    const remaining = solutions
      .filter((s) => !selectedSet.has(s))
      .sort((a, b) => a.totalGap - b.totalGap);

    if (remaining.length > 0) {
      let balancedIdx = 2;
      const numSlots = Math.min(Math.max(3, MAX_SCENARIOS - selected.length), remaining.length);
      for (let i = 0; i < numSlots; i++) {
        const idx = Math.round((i * (remaining.length - 1)) / Math.max(numSlots - 1, 1));
        if (addUnique(remaining[idx], `Balanced ${balancedIdx}`)) {
          balancedIdx++;
        }
      }
    }

    // Fill to 6 minimum if needed
    if (selected.length < 6) {
      const leftover = solutions
        .filter((s) => !selectedSet.has(s))
        .sort((a, b) => a.totalGap - b.totalGap);
      let optIdx = selected.length + 1;
      for (const sol of leftover) {
        if (selected.length >= 6) break;
        if (addUnique(sol, `Option ${optIdx}`)) {
          optIdx++;
        }
      }
    }

    // Return solutions with their names attached
    const result = selected.slice(0, MAX_SCENARIOS);
    // Attach names to solutions for constructScenario to use
    for (const entry of result) {
      (entry.sol as any).__scenarioName = entry.name;
    }
    return result.map((e) => e.sol);
  }

  /**
   * Construct a complete scenario from a solution
   */
  private constructScenario(
    solution: DPSolution,
    name: string,
    tent: TentDimensions,
    railInventory: Rail[],
    c: ResolvedConstraints,
  ): Scenario {
    // Calculate actual width setback
    // Total width consumed = sum of column widths + (numColumns + 1) rails
    const numColumns = solution.columns.length;
    const totalColumnWidth = solution.columns.reduce((sum, col) => sum + col.columnWidth, 0);
    const totalRailWidth = (numColumns + 1) * RAIL_THICKNESS;
    const usableWidth = tent.width - 2 * c.minSetback;
    const additionalSetback = (usableWidth - totalColumnWidth - totalRailWidth) / 2;
    const actualSetback = c.minSetback + Math.max(0, additionalSetback);

    // Use the optimized usable length from the open-end sweep
    const usableLength = solution.optimizedUsableLength ?? (tent.length - 2 * c.minSetback);
    const openEndSetbackStart = solution.openEndSetbackStart ?? c.minSetback;
    const openEndSetbackEnd = solution.openEndSetbackEnd ?? c.minSetback;

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

    // Construct rails (single track pattern; all tracks use same layout)
    const rails = this.constructRails(usableLength, railInventory);
    const railTrackCount = sortedColumns.length + 1;

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
      railTrackCount,
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

    // Build a single rail track pattern (all tracks use the same layout)
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

    return [railSegments];
  }
}
