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
  /** Actual setback used from tent edges in meters (>= 0.15m) */
  setback: number;
  /** Sum of gaps across all columns in square meters */
  totalGap: number;
  /** Array of placed columns */
  columns: Column[];
  /**
   * Array of rail configurations (2 rails per tent, one on each side)
   * Each inner array contains the rail segments for that rail
   */
  rails: RailSegment[][];
  /** Usable width (tent width - 2*setback) in meters */
  usableWidth: number;
  /** Usable length (tent length - 2*setback) in meters */
  usableLength: number;
}

/**
 * Internal type for tracking solutions during DP search
 */
export interface DPSolution {
  /** Excess setback beyond minimum (width not filled) */
  setbackExcess: number;
  /** Total gap area across all columns */
  totalGap: number;
  /** Columns selected in this solution */
  columns: ColumnType[];
  /** Brace usage tracking: key = "LxW" identifier, value = count of braces used */
  braceUsage?: Record<string, number>;
}
