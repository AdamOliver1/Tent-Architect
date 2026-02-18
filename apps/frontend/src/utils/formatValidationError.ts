import type { TFunction } from 'i18next';

const BUSINESS_LOGIC_PATTERNS: Array<{
  test: (msg: string) => boolean;
  translate: (msg: string, t: TFunction) => string;
}> = [
  {
    test: (m) => m.includes('No valid floor plan found in either orientation'),
    translate: (_, t) => t('error.calculation.noValidFloorPlan'),
  },
  {
    test: (m) => m.includes('minSetback cannot be greater than maxSetback'),
    translate: (_, t) => t('error.calculation.minSetbackGreater'),
  },
  {
    test: (m) => m.includes('Tent too small: usable area would be'),
    translate: (m, t) => {
      const match = /usable area would be ([\d.]+)m x ([\d.]+)m/.exec(m);
      return match ? t('error.calculation.tentTooSmall', { length: match[1], width: match[2] }) : t('error.calculation.tentTooSmallGeneric');
    },
  },
  {
    test: (m) => m.includes('No braces can fit in the usable length'),
    translate: (_, t) => t('error.calculation.noBracesFit'),
  },
  {
    test: (m) => m.includes('No valid floor plan found. Insufficient inventory for this orientation'),
    translate: (_, t) => t('error.calculation.insufficientInventoryOrientation'),
  },
  {
    test: (m) => m.includes('Tent dimensions must be positive'),
    translate: (_, t) => t('error.calculation.tentDimensionsPositive'),
  },
  {
    test: (m) => m.includes('Tent dimensions must be at least'),
    translate: (m, t) => {
      const match = /at least ([\d.]+)m/.exec(m);
      return match ? t('error.calculation.tentDimensionsMinSetback', { min: match[1] }) : t('error.calculation.tentDimensionsMinSetbackGeneric');
    },
  },
  {
    test: (m) => m.includes('Insufficient brace inventory: total brace area is'),
    translate: (m, t) => {
      const match = /total brace area is ([\d.]+) m².*at least ([\d.]+) m²/.exec(m);
      return match ? t('error.calculation.insufficientBraceArea', { total: match[1], needed: match[2] }) : t('error.calculation.insufficientBraceAreaGeneric');
    },
  },
  {
    test: (m) => m.includes('Insufficient brace inventory: no single brace type has enough quantity'),
    translate: (m, t) => {
      const match = /usable length: ([\d.]+)m/.exec(m);
      return match ? t('error.calculation.insufficientBraceQuantity', { usableLength: match[1] }) : t('error.calculation.insufficientBraceQuantityGeneric');
    },
  },
];

function tryBusinessLogic(rawMessage: string, t: TFunction): string | null {
  for (const { test, translate } of BUSINESS_LOGIC_PATTERNS) {
    if (test(rawMessage)) return translate(rawMessage, t);
  }
  return null;
}

function tryInventoryService(rawMessage: string, t: TFunction): string | null {
  if (rawMessage.includes('At least one brace type is required')) return t('error.inventory.atLeastOneBrace');
  if (rawMessage.includes('At least one rail type is required')) return t('error.inventory.atLeastOneRail');
  const braceRe = /Brace (\d+): (dimensions must be positive|quantity must be positive)/g;
  const braceMatches = [...rawMessage.matchAll(braceRe)];
  if (braceMatches.length > 0) {
    const dimIndices = new Set<number>();
    const qtyIndices = new Set<number>();
    for (const m of braceMatches) {
      const i = Number.parseInt(m[1], 10);
      m[2].includes('dimensions') ? dimIndices.add(i) : qtyIndices.add(i);
    }
    const lines = [
      ...[...dimIndices].sort((a, b) => a - b).map((i) => t('error.validation.braceLengthInvalid', { index: i })),
      ...[...qtyIndices].sort((a, b) => a - b).map((i) => t('error.validation.braceQuantityInvalid', { index: i })),
    ];
    if (lines.length > 0) return lines.join('\n');
  }
  const railRe = /Rail (\d+): (length must be positive|quantity must be positive)/g;
  const railMatches = [...rawMessage.matchAll(railRe)];
  if (railMatches.length > 0) {
    const lenIndices = new Set<number>();
    const qtyIndices = new Set<number>();
    for (const m of railMatches) {
      const i = Number.parseInt(m[1], 10);
      m[2].includes('length') ? lenIndices.add(i) : qtyIndices.add(i);
    }
    const lines = [
      ...[...lenIndices].sort((a, b) => a - b).map((i) => t('error.validation.railLengthInvalid', { index: i })),
      ...[...qtyIndices].sort((a, b) => a - b).map((i) => t('error.validation.railQuantityInvalid', { index: i })),
    ];
    if (lines.length > 0) return lines.join('\n');
  }
  return null;
}

/**
 * Maps backend validation and business logic errors to user-friendly, translated messages.
 */
export function formatValidationError(
  rawMessage: string,
  t: TFunction
): string {
  if (rawMessage === 'An unexpected error occurred') return t('error.generic');
  const businessResult = tryBusinessLogic(rawMessage, t);
  if (businessResult) return businessResult;

  const inventoryResult = tryInventoryService(rawMessage, t);
  if (inventoryResult) return inventoryResult;

  // ── DTO validation (class-validator: inventory.braces.0.length, etc.) ──
  const parts = rawMessage.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const braceLengthIndices = new Set<number>();
  const braceWidthIndices = new Set<number>();
  const braceQuantityIndices = new Set<number>();
  const railLengthIndices = new Set<number>();
  const railQuantityIndices = new Set<number>();
  let hasOther = false;

  const braceLengthRe = /inventory\.braces\.(\d+)\.length/;
  const braceWidthRe = /inventory\.braces\.(\d+)\.width/;
  const braceQuantityRe = /inventory\.braces\.(\d+)\.quantity/;
  const railLengthRe = /inventory\.rails\.(\d+)\.length/;
  const railQuantityRe = /inventory\.rails\.(\d+)\.quantity/;
  const tentLengthRe = /tent\.length/;
  const tentWidthRe = /tent\.width/;
  for (const part of parts) {
    const braceLengthMatch = braceLengthRe.exec(part);
    const braceWidthMatch = braceWidthRe.exec(part);
    const braceQuantityMatch = braceQuantityRe.exec(part);
    const railLengthMatch = railLengthRe.exec(part);
    const railQuantityMatch = railQuantityRe.exec(part);
    const tentLengthMatch = tentLengthRe.exec(part);
    const tentWidthMatch = tentWidthRe.exec(part);
    if (braceLengthMatch) {
      braceLengthIndices.add(Number.parseInt(braceLengthMatch[1], 10));
    } else if (braceWidthMatch) {
      braceWidthIndices.add(Number.parseInt(braceWidthMatch[1], 10));
    } else if (braceQuantityMatch) {
      braceQuantityIndices.add(Number.parseInt(braceQuantityMatch[1], 10));
    } else if (railLengthMatch) {
      railLengthIndices.add(Number.parseInt(railLengthMatch[1], 10));
    } else if (railQuantityMatch) {
      railQuantityIndices.add(Number.parseInt(railQuantityMatch[1], 10));
    } else if (tentLengthMatch || tentWidthMatch) {
      return t('error.validation.tentDimensionsInvalid');
    } else {
      hasOther = true;
    }
  }

  const lines: string[] = [];
  for (const i of [...braceLengthIndices].sort((a, b) => a - b)) {
    lines.push(t('error.validation.braceLengthInvalid', { index: i + 1 }));
  }
  for (const i of [...braceWidthIndices].sort((a, b) => a - b)) {
    lines.push(t('error.validation.braceWidthInvalid', { index: i + 1 }));
  }
  for (const i of [...braceQuantityIndices].sort((a, b) => a - b)) {
    lines.push(t('error.validation.braceQuantityInvalid', { index: i + 1 }));
  }
  for (const i of [...railLengthIndices].sort((a, b) => a - b)) {
    lines.push(t('error.validation.railLengthInvalid', { index: i + 1 }));
  }
  for (const i of [...railQuantityIndices].sort((a, b) => a - b)) {
    lines.push(t('error.validation.railQuantityInvalid', { index: i + 1 }));
  }
  if (hasOther && lines.length === 0) {
    return rawMessage;
  }
  if (hasOther) {
    lines.push(t('error.validation.other'));
  }

  return lines.length > 0 ? lines.join('\n') : rawMessage;
}
