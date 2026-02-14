/**
 * Describes a single brace type placement within a mixed column
 */
export interface BracePlacement {
  /** Original brace length in meters */
  braceLength: number;
  /** Original brace width in meters */
  braceWidth: number;
  /** Whether the brace is rotated 90 degrees */
  rotated: boolean;
  /** Length each brace fills in the column direction */
  fillLength: number;
  /** Number of this brace type used */
  count: number;
}

/**
 * Describes a column type configuration
 * A column type defines how a particular brace can be used to create a column
 */
export interface ColumnType {
  /** Original brace length in meters */
  braceLength: number;
  /** Original brace width in meters */
  braceWidth: number;
  /** Whether the brace is rotated 90 degrees */
  rotated: boolean;
  /** Width of the column (braceWidth if not rotated, braceLength if rotated) */
  columnWidth: number;
  /** Length each brace fills in the column direction */
  fillLength: number;
  /** Number of braces that fit in the usable length */
  braceCount: number;
  /** Remaining gap at open ends in meters */
  gap: number;
  /** Whether this column uses mixed brace types */
  mixed?: boolean;
  /** Brace placements for mixed columns (undefined for pure columns) */
  bracePlacements?: BracePlacement[];
}

/**
 * A placed column in the floor plan
 */
export interface Column {
  /** The column type configuration used */
  columnType: ColumnType;
  /** X position from left edge in meters */
  position: number;
}

/**
 * A rail segment in the floor plan
 */
export interface RailSegment {
  /** Length of this rail segment in meters */
  length: number;
  /** Position along the tent length in meters */
  position: number;
}

/**
 * A complete floor plan scenario
 */
export interface Scenario {
  /** Name of the scenario (e.g., "Best Width Fit", "Minimum Gaps", "Balanced") */
  name: string;
  /** Actual setback used from tent edges in meters (width direction, rail-end) */
  setback: number;
  /** Open-end setback on the start side (along rail direction) in meters */
  openEndSetbackStart: number;
  /** Open-end setback on the end side (along rail direction) in meters */
  openEndSetbackEnd: number;
  /** Sum of gaps across all columns in square meters */
  totalGap: number;
  /** Array of placed columns */
  columns: Column[];
  /**
   * Array of rail configurations (2 rails per tent, one on each side)
   * Each inner array contains the rail segments for that rail
   */
  rails: RailSegment[][];
  /** Usable width (total column widths + rails) in meters */
  usableWidth: number;
  /** Optimized usable length along rail direction in meters */
  usableLength: number;
  /** Actual tent length used for this scenario (rail direction) */
  tentLength: number;
  /** Actual tent width used for this scenario (column span direction) */
  tentWidth: number;
  /** Number of distinct brace types used */
  distinctBraceTypes: number;
}

/**
 * Internal type for tracking solutions during DP search
 */
export interface DPSolution {
  /** Excess setback beyond minimum (width not filled) */
  setbackExcess: number;
  /** Total gap across all columns (linear meters, not area) */
  totalGap: number;
  /** Columns selected in this solution */
  columns: ColumnType[];
  /** Brace usage tracking: key = "LxW" identifier, value = count of braces used */
  braceUsage?: Record<string, number>;
  /** Number of distinct brace sizes used in this solution */
  distinctBraceTypes: number;
  /** Optimized usable length from open-end sweep (meters) */
  optimizedUsableLength?: number;
  /** Open-end setback on start side (meters) */
  openEndSetbackStart?: number;
  /** Open-end setback on end side (meters) */
  openEndSetbackEnd?: number;
}
