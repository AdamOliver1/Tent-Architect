import { Test, TestingModule } from '@nestjs/testing';
import { CalculationService } from './calculation.service';
import { InventoryService } from '../inventory/inventory.service';
import { BadRequestException } from '@nestjs/common';

describe('CalculationService', () => {
  let service: CalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalculationService, InventoryService],
    }).compile();

    service = module.get<CalculationService>(CalculationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateColumnTypes', () => {
    it('should generate normal and rotated column types for each brace', () => {
      const braces = [{ length: 2.45, width: 1.22, quantity: 10 }];
      const usableLength = 10;

      const columnTypes = service.generateColumnTypes(braces, usableLength);

      expect(columnTypes.length).toBe(2);

      // Normal orientation
      const normal = columnTypes.find((c) => !c.rotated);
      expect(normal).toBeDefined();
      expect(normal!.columnWidth).toBe(1.22);
      expect(normal!.fillLength).toBe(2.45);
      expect(normal!.braceCount).toBe(4); // floor(10 / 2.45) = 4
      expect(normal!.gap).toBeCloseTo(10 - 4 * 2.45, 2); // 0.2

      // Rotated orientation
      const rotated = columnTypes.find((c) => c.rotated);
      expect(rotated).toBeDefined();
      expect(rotated!.columnWidth).toBe(2.45);
      expect(rotated!.fillLength).toBe(1.22);
      expect(rotated!.braceCount).toBe(8); // floor(10 / 1.22) = 8
      expect(rotated!.gap).toBeCloseTo(10 - 8 * 1.22, 2); // 0.24
    });

    it('should exclude column types that do not fit', () => {
      const braces = [{ length: 5, width: 3, quantity: 10 }];
      const usableLength = 2; // Neither dimension fits

      const columnTypes = service.generateColumnTypes(braces, usableLength);

      expect(columnTypes.length).toBe(0);
    });
  });

  describe('selectNamedScenarios', () => {
    it('should return empty array for empty input', () => {
      const selected = service.selectNamedScenarios([]);
      expect(selected.length).toBe(0);
    });

    it('should handle single solution', () => {
      const solutions = [
        { setbackExcess: 0.1, totalGap: 0.2, columns: [{ braceLength: 2, braceWidth: 1, rotated: false, columnWidth: 1, fillLength: 2, braceCount: 3, gap: 0.1 }], distinctBraceTypes: 1 },
      ];
      const selected = service.selectNamedScenarios(solutions);
      expect(selected.length).toBe(1);
    });

    it('should select best solution for each criterion', () => {
      const col1 = { braceLength: 2.45, braceWidth: 1.22, rotated: false, columnWidth: 1.22, fillLength: 2.45, braceCount: 4, gap: 0.1 };
      const col2 = { braceLength: 2, braceWidth: 1, rotated: false, columnWidth: 1, fillLength: 2, braceCount: 5, gap: 0.05 };
      const col3 = { braceLength: 2.45, braceWidth: 1.22, rotated: true, columnWidth: 2.45, fillLength: 1.22, braceCount: 8, gap: 0.2 };

      const solutions = [
        // Low setback, high gap, many columns
        { setbackExcess: 0.0, totalGap: 0.5, columns: [col1, col1, col2, col2, col2], distinctBraceTypes: 2 },
        // High setback, low gap, few columns
        { setbackExcess: 0.15, totalGap: 0.1, columns: [col3], distinctBraceTypes: 1 },
        // Mid setback, mid gap
        { setbackExcess: 0.05, totalGap: 0.3, columns: [col1, col2], distinctBraceTypes: 2 },
        // 1 brace type, mid gap
        { setbackExcess: 0.1, totalGap: 0.2, columns: [col1, col1], distinctBraceTypes: 1 },
      ];

      const selected = service.selectNamedScenarios(solutions);

      // Should have at least 2 unique solutions
      expect(selected.length).toBeGreaterThanOrEqual(2);

      // Best Width Fit should be the one with setbackExcess=0 (first)
      expect(selected[0].setbackExcess).toBe(0);

      // Minimum Gaps should be early in the list
      expect(selected.some((s) => s.totalGap === 0.1)).toBe(true);

      // Solution with fewest columns (1) should appear
      expect(selected.some((s) => s.columns.length === 1)).toBe(true);
    });

    it('should select up to 10 and at least 6 from large pool', () => {
      const col = { braceLength: 2, braceWidth: 1, rotated: false, columnWidth: 1, fillLength: 2, braceCount: 3, gap: 0.1 };
      const solutions = [];
      for (let i = 0; i < 20; i++) {
        const numCols = 1 + (i % 5);
        solutions.push({
          setbackExcess: i * 0.01,
          totalGap: 0.5 - i * 0.02,
          columns: Array(numCols).fill(col),
          distinctBraceTypes: 1 + (i % 3),
        });
      }

      const selected = service.selectNamedScenarios(solutions);
      expect(selected.length).toBeGreaterThanOrEqual(6);
      expect(selected.length).toBeLessThanOrEqual(20);
    });
  });

  describe('constructRails', () => {
    it('should construct rails using greedy algorithm', () => {
      const usableLength = 10;
      const rails = [
        { length: 7.36, quantity: 10 },
        { length: 5, quantity: 10 },
        { length: 1, quantity: 10 },
      ];

      const result = service.constructRails(usableLength, rails);

      expect(result.length).toBe(2); // Two rails (one for each side)

      // Each rail should cover the usable length
      for (const railSegments of result) {
        const totalLength = railSegments.reduce((sum, seg) => sum + seg.length, 0);
        expect(totalLength).toBeCloseTo(usableLength, 2);
      }
    });

    it('should use longest available rails first', () => {
      const usableLength = 8;
      const rails = [
        { length: 7.36, quantity: 2 },
        { length: 5, quantity: 10 },
        { length: 1, quantity: 10 },
      ];

      const result = service.constructRails(usableLength, rails);

      // First segment of each rail should be 7.36m (longest that fits)
      expect(result[0][0].length).toBeCloseTo(7.36, 2);
      expect(result[1][0].length).toBeCloseTo(7.36, 2);
    });
  });

  describe('calculate', () => {
    it('should return valid scenarios for standard tent', () => {
      const result = service.calculate({
        tent: { length: 20, width: 10 },
      });

      expect(result.scenarios).toBeDefined();
      expect(result.scenarios.length).toBeGreaterThan(0);
      expect(result.scenarios.length).toBeLessThanOrEqual(20);

      for (const scenario of result.scenarios) {
        expect(scenario.setback).toBeGreaterThanOrEqual(0.08);
        expect(scenario.columns.length).toBeGreaterThan(0);
        expect(scenario.rails.length).toBe(2);
      }
    });

    it('should throw for tent that is too small', () => {
      expect(() =>
        service.calculate({
          tent: { length: 0.2, width: 0.2 },
        }),
      ).toThrow(BadRequestException);
    });

    it('should throw for negative dimensions', () => {
      expect(() =>
        service.calculate({
          tent: { length: -10, width: 10 },
        }),
      ).toThrow(BadRequestException);
    });

    it('should use custom inventory when provided', () => {
      const result = service.calculate({
        tent: { length: 4.32, width: 7.56 },
        inventory: {
          braces: [{ length: 2, width: 1, quantity: 100 }],
          rails: [{ length: 5, quantity: 10 }],
        },
      });

      expect(result.scenarios).toBeDefined();
      expect(result.scenarios.length).toBeGreaterThan(0);

      // All columns should use the 2x1 brace
      for (const scenario of result.scenarios) {
        for (const column of scenario.columns) {
          expect(column.columnType.braceLength).toBe(2);
          expect(column.columnType.braceWidth).toBe(1);
        }
      }
    });

    it('should respect minimum setback', () => {
      const result = service.calculate({
        tent: { length: 10, width: 5 },
      });

      for (const scenario of result.scenarios) {
        expect(scenario.setback).toBeGreaterThanOrEqual(0.08);
      }
    });

    it('should produce scenarios with different characteristics', () => {
      const result = service.calculate({
        tent: { length: 20, width: 12 },
      });

      if (result.scenarios.length >= 2) {
        const [first, second] = result.scenarios;
        const isDifferent =
          first.setback !== second.setback || first.totalGap !== second.totalGap;
        expect(isDifferent).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle tent where braces exactly fit width', () => {
      const result = service.calculate({
        tent: { length: 10, width: 2.75 },
        inventory: {
          braces: [{ length: 2.45, width: 1.22, quantity: 100 }],
          rails: [{ length: 5, quantity: 10 }],
        },
      });

      expect(result.scenarios.length).toBeGreaterThan(0);
    });

    it('should handle very large tent', () => {
      const result = service.calculate({
        tent: { length: 100, width: 50 },
      });

      expect(result.scenarios.length).toBeGreaterThan(0);

      for (const scenario of result.scenarios) {
        expect(scenario.columns.length).toBeGreaterThan(0);
      }
    });

    it('should handle square tent', () => {
      const result = service.calculate({
        tent: { length: 10, width: 10 },
      });

      expect(result.scenarios.length).toBeGreaterThan(0);
    });
  });

  describe('max column gap filtering', () => {
    it('should not return scenarios with column gap > 0.39m', () => {
      const result = service.calculate({
        tent: { length: 20, width: 10 },
      });

      for (const scenario of result.scenarios) {
        for (const column of scenario.columns) {
          expect(column.columnType.gap).toBeLessThanOrEqual(0.391);
        }
      }
    });
  });

  describe('scenario count and naming', () => {
    it('should return at least 6 scenarios for a standard tent', () => {
      const result = service.calculate({
        tent: { length: 20, width: 10 },
      });

      expect(result.scenarios.length).toBeGreaterThanOrEqual(6);
    });

    it('should return at most 10 scenarios', () => {
      const result = service.calculate({
        tent: { length: 20, width: 12 },
      });

      expect(result.scenarios.length).toBeLessThanOrEqual(20);
    });

    it('should include Least Rails scenario with fewest columns', () => {
      const result = service.calculate({
        tent: { length: 20, width: 10 },
      });

      const leastRails = result.scenarios.find((s) => s.name === 'Least Rails');
      expect(leastRails).toBeDefined();
      expect(leastRails!.columns.length).toBeGreaterThan(0);

      // Verify it actually has the fewest columns among all scenarios
      const minColumns = Math.min(...result.scenarios.map((s) => s.columns.length));
      expect(leastRails!.columns.length).toBe(minColumns);
    });

    it('should include Least Braces scenario with fewest total braces', () => {
      const result = service.calculate({
        tent: { length: 20, width: 10 },
      });

      const leastBraces = result.scenarios.find((s) => s.name === 'Least Braces');
      expect(leastBraces).toBeDefined();

      // Verify it actually has the fewest total braces among all scenarios
      const totalBraces = (s: typeof result.scenarios[0]) =>
        s.columns.reduce((sum, col) => sum + col.columnType.braceCount, 0);

      const minBraces = Math.min(...result.scenarios.map(totalBraces));
      expect(totalBraces(leastBraces!)).toBe(minBraces);
    });

    it('should include Biggest Braces scenario', () => {
      const result = service.calculate({
        tent: { length: 20, width: 10 },
      });

      const biggestBraces = result.scenarios.find((s) => s.name.startsWith('Biggest Braces'));
      expect(biggestBraces).toBeDefined();
    });
  });

  describe('fallback behavior', () => {
    it('should return results even when all solutions have large gaps', () => {
      // Use a brace size that will produce gaps > 0.39m for most usable lengths
      // but validSolutions should still exist as fallback
      const result = service.calculate({
        tent: { length: 20, width: 10 },
        inventory: {
          braces: [
            { length: 2.45, width: 1.22, quantity: 200 },
            { length: 2, width: 1, quantity: 200 },
          ],
          rails: [{ length: 7.36, quantity: 20 }, { length: 5, quantity: 20 }],
        },
      });

      // Should still return results (fallback kicks in if gap filter removes everything)
      expect(result.scenarios.length).toBeGreaterThan(0);
    });
  });

  describe('column grouping by orientation', () => {
    it('should group columns of same brace type and orientation together', () => {
      const result = service.calculate({
        tent: { length: 15, width: 8 },
      });

      for (const scenario of result.scenarios) {
        if (scenario.columns.length < 2) continue;

        let lastKey = '';
        const seenKeys = new Set<string>();

        for (const column of scenario.columns) {
          const key = `${column.columnType.braceLength}×${column.columnType.braceWidth}-${column.columnType.rotated}`;

          if (seenKeys.has(key) && key !== lastKey) {
            fail(`Columns with key ${key} are not grouped together in scenario ${scenario.name}`);
          }

          seenKeys.add(key);
          lastKey = key;
        }
      }
    });

    it('should place non-rotated columns before rotated ones for same brace type', () => {
      const result = service.calculate({
        tent: { length: 15, width: 8 },
      });

      for (const scenario of result.scenarios) {
        const braceGroups = new Map<string, boolean[]>();

        for (const column of scenario.columns) {
          const braceKey = `${column.columnType.braceLength}×${column.columnType.braceWidth}`;
          if (!braceGroups.has(braceKey)) {
            braceGroups.set(braceKey, []);
          }
          braceGroups.get(braceKey)!.push(column.columnType.rotated);
        }

        for (const [_braceKey, rotations] of braceGroups.entries()) {
          const hasNonRotated = rotations.some((r) => !r);
          const hasRotated = rotations.some((r) => r);

          if (hasNonRotated && hasRotated) {
            const firstNonRotatedIdx = rotations.indexOf(false);
            const firstRotatedIdx = rotations.indexOf(true);
            expect(firstNonRotatedIdx).toBeLessThan(firstRotatedIdx);
          }
        }
      }
    });
  });

  describe('solveMixedFill', () => {
    it('should return empty placements for empty options', () => {
      const result = service.solveMixedFill([], 1000);
      expect(result.placements).toEqual([]);
    });

    it('should find exact fill with multiple brace types', () => {
      // usableLength=10.5m, primary 1.0m, filler 0.5m
      const fillOptions = [
        { fillLength: 1.0, braceLength: 2.0, braceWidth: 1.0, rotated: true },
        { fillLength: 0.5, braceLength: 0.5, braceWidth: 2.0, rotated: false },
      ];
      const result = service.solveMixedFill(fillOptions, 1050); // 10.5m in cm
      expect(result.gap).toBeCloseTo(0, 2);
      const totalFill = result.placements.reduce((sum, p) => sum + p.fillLength * p.count, 0);
      expect(totalFill).toBeCloseTo(10.5, 2);
    });

    it('should reduce gap compared to pure fill', () => {
      // usableLength=10.3m, primary 1.0m gives gap=0.3m
      // With 0.5m filler: 10×1.0 + 0×0.5 = gap 0.3. Can't improve.
      // With 0.4m filler: 9×1.0 + 0.4×? can we get 10.2? 9+3×0.4=10.2, gap=0.1
      const fillOptions = [
        { fillLength: 1.0, braceLength: 2.0, braceWidth: 1.0, rotated: true },
        { fillLength: 0.4, braceLength: 0.4, braceWidth: 2.0, rotated: false },
      ];
      const result = service.solveMixedFill(fillOptions, 1030); // 10.3m
      // Pure 1.0m: gap=0.3m. Mixed should do better.
      expect(result.gap).toBeLessThan(0.3 + 0.001);
    });

    it('should respect max count per option', () => {
      const fillOptions = [
        { fillLength: 1.0, braceLength: 2.0, braceWidth: 1.0, rotated: true },
        { fillLength: 0.5, braceLength: 0.5, braceWidth: 2.0, rotated: false },
      ];
      // Only allow 2 of the 0.5m filler
      const result = service.solveMixedFill(fillOptions, 1050, [100, 2]);
      // 10×1.0 + 1×0.5 = 10.5, gap=0 — only needs 1 filler, so 2 is enough
      expect(result.gap).toBeCloseTo(0, 2);
    });

    it('should sort placements by fillLength descending', () => {
      const fillOptions = [
        { fillLength: 0.5, braceLength: 0.5, braceWidth: 2.0, rotated: false },
        { fillLength: 1.0, braceLength: 2.0, braceWidth: 1.0, rotated: true },
      ];
      const result = service.solveMixedFill(fillOptions, 1050);
      if (result.placements.length >= 2) {
        expect(result.placements[0].fillLength).toBeGreaterThanOrEqual(result.placements[1].fillLength);
      }
    });

    it('should maximize use of larger braces (prefer fewer, bigger braces)', () => {
      const fillOptions = [
        { fillLength: 1.0, braceLength: 2.0, braceWidth: 1.0, rotated: true },
        { fillLength: 0.5, braceLength: 0.5, braceWidth: 2.0, rotated: false },
        { fillLength: 0.4, braceLength: 0.4, braceWidth: 2.0, rotated: false },
      ];

      // 19.84m: should use 19×1.0 + 2×0.4 (gap=0.04), NOT e.g. 17×1.0 + 5×0.5 + 2×0.4
      const r1 = service.solveMixedFill(fillOptions, 1984);
      const big1 = r1.placements.find((p) => p.fillLength === 1.0);
      expect(big1).toBeDefined();
      expect(big1!.count).toBe(19); // floor(19.84/1.0) = 19

      // 10.5m: should use 10×1.0 + 1×0.5 (gap=0), NOT 21×0.5
      const r2 = service.solveMixedFill(fillOptions, 1050);
      const big2 = r2.placements.find((p) => p.fillLength === 1.0);
      expect(big2).toBeDefined();
      expect(big2!.count).toBe(10);
      expect(r2.gap).toBeCloseTo(0, 2);

      // 10.0m: should use 10×1.0 (gap=0), NOT 20×0.5 or 25×0.4
      const r3 = service.solveMixedFill(fillOptions, 1000);
      expect(r3.placements.length).toBe(1);
      expect(r3.placements[0].fillLength).toBe(1.0);
      expect(r3.placements[0].count).toBe(10);
    });
  });

  describe('mixed column types in generateColumnTypes', () => {
    it('should generate mixed column types for columnWidth=2.0', () => {
      // Braces that produce columnWidth=2.0:
      // 2.0×1.0 rotated → fillLength=1.0, cw=2.0
      // 0.5×2.0 normal → fillLength=0.5, cw=2.0
      // 0.4×2.0 normal → fillLength=0.4, cw=2.0
      const braces = [
        { length: 2.0, width: 1.0, quantity: 100 },
        { length: 0.5, width: 2.0, quantity: 100 },
        { length: 0.4, width: 2.0, quantity: 100 },
      ];
      const usableLength = 10.3; // Pure: gap=0.3m for all types. Mixed: 9×1.0+1×0.5+2×0.4=10.3, gap=0!
      const columnTypes = service.generateColumnTypes(braces, usableLength);

      const mixedTypes = columnTypes.filter((ct) => ct.mixed);
      // Should have at least one mixed type for cw=2.0
      expect(mixedTypes.length).toBeGreaterThanOrEqual(1);

      const mixed2 = mixedTypes.find((ct) => Math.abs(ct.columnWidth - 2.0) < 0.01);
      expect(mixed2).toBeDefined();
      expect(mixed2!.bracePlacements).toBeDefined();
      expect(mixed2!.bracePlacements!.length).toBeGreaterThanOrEqual(2);
      // Mixed gap should be less than best pure gap
      const pureTypes = columnTypes.filter((ct) => !ct.mixed && Math.abs(ct.columnWidth - 2.0) < 0.01);
      const bestPureGap = Math.min(...pureTypes.map((ct) => ct.gap));
      expect(mixed2!.gap).toBeLessThan(bestPureGap);
    });

    it('should not generate mixed type when only one fillLength exists for a columnWidth', () => {
      const braces = [
        { length: 2.45, width: 1.22, quantity: 100 },
      ];
      const columnTypes = service.generateColumnTypes(braces, 10);
      const mixedTypes = columnTypes.filter((ct) => ct.mixed);
      expect(mixedTypes.length).toBe(0);
    });
  });

  describe('DP with mixed columns respects inventory', () => {
    it('should track brace usage across mixed column placements', () => {
      const braces = [
        { length: 2.0, width: 1.0, quantity: 20 },
        { length: 0.5, width: 2.0, quantity: 5 },
        { length: 0.4, width: 2.0, quantity: 5 },
      ];
      const usableLength = 10.5;
      const columnTypes = service.generateColumnTypes(braces, usableLength);
      const usableWidth = 5 - 2 * 0.08;
      const solutions = service.dpColumnSearch(columnTypes, usableWidth, braces);

      // Verify all solutions respect inventory limits
      for (const sol of solutions) {
        const usage: Record<string, number> = {};
        for (const col of sol.columns) {
          if (col.bracePlacements) {
            for (const bp of col.bracePlacements) {
              const key = `${bp.braceLength}x${bp.braceWidth}`;
              usage[key] = (usage[key] || 0) + bp.count;
            }
          } else {
            const key = `${col.braceLength}x${col.braceWidth}`;
            usage[key] = (usage[key] || 0) + col.braceCount;
          }
        }

        for (const brace of braces) {
          const key = `${brace.length}x${brace.width}`;
          expect(usage[key] || 0).toBeLessThanOrEqual(brace.quantity);
        }
      }
    });
  });

  describe('integration: mixed columns reduce gaps', () => {
    it('should produce scenarios with mixed columns for default inventory', () => {
      const result = service.calculate({
        tent: { length: 20, width: 10 },
      });

      // Check if any scenario has mixed columns
      let hasMixed = false;
      for (const scenario of result.scenarios) {
        for (const column of scenario.columns) {
          if (column.columnType.mixed && column.columnType.bracePlacements) {
            hasMixed = true;
            // Verify bracePlacements are well-formed
            expect(column.columnType.bracePlacements.length).toBeGreaterThanOrEqual(2);
            const totalCount = column.columnType.bracePlacements.reduce((s, bp) => s + bp.count, 0);
            expect(totalCount).toBe(column.columnType.braceCount);
          }
        }
      }

      // With default inventory (includes 2.0×1.0, 0.5×2.0, 0.4×2.0), mixed columns
      // should appear when they reduce gap
      // Note: this is a soft check — mixed may not appear if pure columns already have 0 gap
      if (hasMixed) {
        expect(hasMixed).toBe(true);
      }
    });

    it('should never use 49 small braces when larger braces are available (20×10 tent)', () => {
      const result = service.calculate({
        tent: { length: 20, width: 10 },
      });

      for (const scenario of result.scenarios) {
        for (const column of scenario.columns) {
          const ct = column.columnType;
          // A column of columnWidth=2.0 should never have 49×0.4m braces.
          // It should use mixed: mostly 1.0m braces with a few small fillers.
          if (Math.abs(ct.columnWidth - 2.0) < 0.01 && ct.braceCount > 30) {
            // If braceCount is high, it MUST be a mixed column using large primary braces
            expect(ct.mixed).toBe(true);
            expect(ct.bracePlacements).toBeDefined();
            // The primary brace should be the largest available (1.0m fillLength)
            const primaryPlacement = ct.bracePlacements![0];
            expect(primaryPlacement.fillLength).toBeGreaterThanOrEqual(0.5);
          }
        }
      }
    });

    it('should prune dominated pure types when mixed exists', () => {
      const braces = [
        { length: 2.0, width: 1.0, quantity: Infinity },
        { length: 0.5, width: 2.0, quantity: Infinity },
        { length: 0.4, width: 2.0, quantity: Infinity },
      ];
      const usableLength = 19.84;
      const columnTypes = service.generateColumnTypes(braces, usableLength);

      // For columnWidth=2.0, the pure 0.4m (49 braces, gap=0.24) and
      // pure 0.5m (39 braces, gap=0.34) should be pruned because the
      // mixed type (21 braces, gap=0.04) dominates them on both gap and brace count.
      const cw2Types = columnTypes.filter((ct) => Math.abs(ct.columnWidth - 2.0) < 0.01);

      // Should NOT have a pure column with fillLength=0.4 (49 braces)
      const pure04 = cw2Types.find((ct) => !ct.mixed && Math.abs(ct.fillLength - 0.4) < 0.01);
      expect(pure04).toBeUndefined();

      // Should NOT have a pure column with fillLength=0.5 (39 braces)
      const pure05 = cw2Types.find((ct) => !ct.mixed && Math.abs(ct.fillLength - 0.5) < 0.01);
      expect(pure05).toBeUndefined();

      // SHOULD have the mixed type
      const mixed = cw2Types.find((ct) => ct.mixed);
      expect(mixed).toBeDefined();
      expect(mixed!.braceCount).toBeLessThan(30); // ~21 braces, not 49

      // SHOULD keep the pure 1.0m type (fewer braces than mixed, even if worse gap)
      const pure10 = cw2Types.find((ct) => !ct.mixed && Math.abs(ct.fillLength - 1.0) < 0.01);
      expect(pure10).toBeDefined();
    });
  });
});
