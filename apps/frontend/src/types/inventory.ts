export interface Brace {
  length: number;
  width: number;
  quantity: number;
}

export interface Rail {
  length: number;
  quantity: number;
}

export interface Inventory {
  braces: Brace[];
  rails: Rail[];
}
