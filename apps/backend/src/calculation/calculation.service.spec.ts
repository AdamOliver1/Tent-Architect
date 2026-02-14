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

      expect(selected.length).toBeGreaterThanOrEqual(4);

      // Best Width Fit should be the one with setbackExcess=0
      expect(selected[0].setbackExcess).toBe(0);

      // Minimum Gaps should be the one with totalGap=0.1
      expect(selected[1].totalGap).toBe(0.1);

      // Least Brace Kinds should have distinctBraceTypes=1
      expect(selected[2].distinctBraceTypes).toBe(1);

      // Least Rails should have fewest columns
      const leastRails = selected[3];
      expect(leastRails.columns.length).toBe(1);
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
      expect(selected.length).toBeLessThanOrEqual(10);
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
      expect(result.scenarios.length).toBeLessThanOrEqual(10);

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

      expect(result.scenarios.length).toBeLessThanOrEqual(10);
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

      const biggestBraces = result.scenarios.find((s) => s.name === 'Biggest Braces');
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
});

  describe('DEBUG: DP column search for 20x10 tent', () => {
    it('should show all DP solutions and column counts', () => {
      const braces = [
        { length: 2.45, width: 1.22, quantity: 200 },
        { length: 2, width: 1, quantity: 200 },
        { length: 0.5, width: 2, quantity: 200 },
        { length: 0.6, width: 2.44, quantity: 200 },
      ];
      const usableLength = 20 - 2 * 0.08;
      const usableWidth = 10 - 2 * 0.08;
      const columnTypes = service.generateColumnTypes(braces, usableLength);
      console.log('\n=== Column Types Generated ===');
      console.log('Total column types:', columnTypes.length);
      for (const c of columnTypes) {
        console.log(`  ${c.columnWidth.toFixed(3)}m (${c.braceLength}x${c.braceWidth} rot=${c.rotated}, gap=${c.gap.toFixed(4)})`);
      }
      
      const solutions = service.dpColumnSearch(columnTypes, usableWidth, braces);
      console.log('\n=== DP Solutions ===');
      console.log('Total DP solutions:', solutions.length);
      
      const colCounts = [...new Set(solutions.map((s: any) => s.columns.length))].sort((a: number,b: number) => a-b);
      console.log('Distinct column counts:', colCounts);
      
      const minCols = Math.min(...solutions.map((s: any) => s.columns.length));
      const fewestColSolutions = solutions.filter((s: any) => s.columns.length === minCols);
      console.log(`\nSolutions with ${minCols} columns:`, fewestColSolutions.length);
      for (const s of fewestColSolutions.slice(0, 5)) {
        console.log(`  gap=${s.totalGap.toFixed(4)} setbackExcess=${s.setbackExcess.toFixed(4)} types=${s.distinctBraceTypes} cols=[${s.columns.map((c: any) => c.columnWidth.toFixed(3)).join(', ')}]`);
      }

      const selected = service.selectNamedScenarios(solutions);
      console.log('\n=== Selected Scenarios ===');
      for (const s of selected) {
        const totalBraces = s.columns.reduce((sum: number, col: any) => sum + col.braceCount, 0);
        console.log(`${s.name}: ${s.columns.length} cols, ${totalBraces} braces, gap=${s.totalGap.toFixed(4)}, setback=${s.setbackExcess.toFixed(4)}`);
      }
      
      const leastRails = selected.find((s: any) => s.name === 'Least Rails');
      console.log('\nLeast Rails column count:', leastRails?.columns.length);
      console.log('Min column count in DP solutions:', minCols);
      
      expect(leastRails).toBeDefined();
      expect(leastRails!.columns.length).toBe(minCols);
    });
  });
});
