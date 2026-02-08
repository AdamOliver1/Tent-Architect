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

/** Minimum setback from tent edges in meters (15cm) */
const MIN_SETBACK = 0.15;

/** Precision for discretization in meters (1cm) */
const PRECISION = 0.01;

/** Maximum additional setback to consider (in meters) */
const MAX_SETBACK_INCREASE = 1.0;

@Injectable()
export class CalculationService {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Main calculation endpoint
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

    // Calculate usable dimensions with minimum setback
    const usableLength = tent.length - 2 * MIN_SETBACK;
    const usableWidth = tent.width - 2 * MIN_SETBACK;

    if (usableLength <= 0 || usableWidth <= 0) {
      throw new BadRequestException(
        `Tent too small: usable area would be ${usableLength.toFixed(2)}m x ${usableWidth.toFixed(2)}m`,
      );
    }

    // Generate all possible column types
    const columnTypes = this.generateColumnTypes(inventory.braces, usableLength);

    if (columnTypes.length === 0) {
      throw new BadRequestException(
        'No braces can fit in the usable length. Check brace dimensions.',
      );
    }

    // Find column combinations using DP
    const solutions = this.dpColumnSearch(columnTypes, usableWidth);

    if (solutions.length === 0) {
      throw new BadRequestException(
        'No valid floor plan found. The tent may be too narrow for available braces.',
      );
    }

    // Select Pareto-optimal scenarios
    const selectedSolutions = this.selectParetoFront(solutions);

    // Construct full scenarios with rails
    const scenarios = selectedSolutions.map((solution, index) => {
      const names = ['Best Width Fit', 'Minimum Gaps', 'Balanced'];
      return this.constructScenario(
        solution,
        names[index] || `Scenario ${index + 1}`,
        tent,
        inventory.rails,
      );
    });

    return {
      scenarios,
      tent,
    };
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
   * Dynamic Programming search to find optimal column combinations
   * Uses discretization to centimeters for efficient state space
   */
  dpColumnSearch(columnTypes: ColumnType[], targetWidth: number): DPSolution[] {
    // Convert to centimeters for integer math
    const targetCm = Math.round(targetWidth / PRECISION);
    const maxSetbackIncreaseCm = Math.round(MAX_SETBACK_INCREASE / PRECISION);

    // State: Map from width (in cm) to Pareto set of solutions
    // Each solution tracks {setbackExcess, totalGap, columns}
    const states = new Map<number, DPSolution[]>();

    // Initialize with empty solution at width 0
    states.set(0, [{ setbackExcess: 0, totalGap: 0, columns: [] }]);

    // Process states in order of increasing width
    const processedWidths = new Set<number>();
    const widthsToProcess = [0];

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
        const newWidthCm = currentWidthCm + columnWidthCm;

        // Skip if we would exceed target width
        if (newWidthCm > targetCm) {
          continue;
        }

        // Create new solutions by extending current ones
        for (const solution of currentSolutions) {
          const newSolution: DPSolution = {
            setbackExcess: 0, // Will be set when we reach terminal state
            totalGap: solution.totalGap + columnType.gap,
            columns: [...solution.columns, columnType],
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
   * Add a solution to a state, maintaining Pareto optimality
   */
  private addSolutionToState(
    states: Map<number, DPSolution[]>,
    widthCm: number,
    newSolution: DPSolution,
  ): void {
    const existing = states.get(widthCm) || [];

    // Check if new solution is dominated by any existing solution
    const isDominated = existing.some(
      (s) => s.totalGap <= newSolution.totalGap && s.columns.length <= newSolution.columns.length,
    );

    if (isDominated) {
      return;
    }

    // Remove solutions dominated by the new one
    const nonDominated = existing.filter(
      (s) => !(newSolution.totalGap <= s.totalGap && newSolution.columns.length <= s.columns.length),
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
   * Select up to 3 scenarios from the Pareto front
   * 1. Best Width Fit (minimum setback excess)
   * 2. Minimum Gaps (minimum total gap)
   * 3. Balanced (knee point)
   */
  selectParetoFront(solutions: DPSolution[]): DPSolution[] {
    if (solutions.length === 0) {
      return [];
    }

    // Filter to true Pareto optimal solutions
    const paretoOptimal = solutions.filter((s1) => {
      return !solutions.some(
        (s2) =>
          s2 !== s1 &&
          s2.setbackExcess <= s1.setbackExcess &&
          s2.totalGap <= s1.totalGap &&
          (s2.setbackExcess < s1.setbackExcess || s2.totalGap < s1.totalGap),
      );
    });

    if (paretoOptimal.length === 0) {
      return [solutions[0]];
    }

    if (paretoOptimal.length === 1) {
      return paretoOptimal;
    }

    // Sort by setback excess (ascending)
    paretoOptimal.sort((a, b) => a.setbackExcess - b.setbackExcess);

    const selected: DPSolution[] = [];

    // 1. Best Width Fit: minimum setback excess
    selected.push(paretoOptimal[0]);

    // 2. Minimum Gaps: minimum total gap
    const minGapSolution = paretoOptimal.reduce((best, current) =>
      current.totalGap < best.totalGap ? current : best,
    );

    // Only add if different from first
    if (minGapSolution !== selected[0]) {
      selected.push(minGapSolution);
    }

    // 3. Balanced: find knee point using normalized distance
    if (paretoOptimal.length > 2) {
      const maxSetback = Math.max(...paretoOptimal.map((s) => s.setbackExcess));
      const minSetback = Math.min(...paretoOptimal.map((s) => s.setbackExcess));
      const maxGap = Math.max(...paretoOptimal.map((s) => s.totalGap));
      const minGap = Math.min(...paretoOptimal.map((s) => s.totalGap));

      const setbackRange = maxSetback - minSetback || 1;
      const gapRange = maxGap - minGap || 1;

      // Find point closest to origin in normalized space
      let balanced = paretoOptimal[0];
      let minDistance = Infinity;

      for (const solution of paretoOptimal) {
        const normSetback = (solution.setbackExcess - minSetback) / setbackRange;
        const normGap = (solution.totalGap - minGap) / gapRange;
        const distance = Math.sqrt(normSetback * normSetback + normGap * normGap);

        if (distance < minDistance) {
          minDistance = distance;
          balanced = solution;
        }
      }

      // Only add if different from already selected
      if (!selected.includes(balanced)) {
        selected.push(balanced);
      }
    }

    // Ensure we return at most 3 unique scenarios
    return selected.slice(0, 3);
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
    // Calculate actual setback
    const totalColumnWidth = solution.columns.reduce((sum, col) => sum + col.columnWidth, 0);
    const usableWidth = tent.width - 2 * MIN_SETBACK;
    const additionalSetback = (usableWidth - totalColumnWidth) / 2;
    const actualSetback = MIN_SETBACK + additionalSetback;

    // Calculate usable length with actual setback
    const usableLength = tent.length - 2 * actualSetback;

    // Place columns
    const columns: Column[] = [];
    let position = actualSetback;

    for (const columnType of solution.columns) {
      columns.push({
        columnType,
        position,
      });
      position += columnType.columnWidth;
    }

    // Construct rails (2 rails, one on each side of the floor)
    const rails = this.constructRails(usableLength, railInventory);

    // Calculate total gap area
    const totalGap = solution.columns.reduce(
      (sum, col) => sum + col.gap * col.columnWidth,
      0,
    );

    return {
      name,
      setback: Math.round(actualSetback * 1000) / 1000, // Round to mm precision
      totalGap: Math.round(totalGap * 1000) / 1000,
      columns,
      rails,
      usableWidth: Math.round(totalColumnWidth * 1000) / 1000,
      usableLength: Math.round(usableLength * 1000) / 1000,
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
