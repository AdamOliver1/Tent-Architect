export interface ColumnType {
  braceLength: number;
  braceWidth: number;
  rotated: boolean;
  columnWidth: number;
  fillLength: number;
  braceCount: number;
  gap: number;
}

export interface Column {
  columnType: ColumnType;
  position: number;
}

export interface RailSegment {
  length: number;
  position: number;
}

export interface Scenario {
  name: string;
  setback: number;
  openEndSetbackStart: number;
  openEndSetbackEnd: number;
  totalGap: number;
  columns: Column[];
  rails: RailSegment[][];
  usableWidth: number;
  usableLength: number;
  tentLength: number;
  tentWidth: number;
  distinctBraceTypes: number;
}
