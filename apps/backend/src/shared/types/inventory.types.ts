/**
 * Brace (floor panel) specification
 */
export interface Brace {
  /** Length of the brace in meters */
  length: number;
  /** Width of the brace in meters */
  width: number;
  /** Available quantity */
  quantity: number;
}

/**
 * Rail specification
 */
export interface Rail {
  /** Length of the rail in meters */
  length: number;
  /** Available quantity */
  quantity: number;
}

/**
 * Complete inventory of available materials
 */
export interface Inventory {
  /** Available braces */
  braces: Brace[];
  /** Available rails */
  rails: Rail[];
}
