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

  describe('selectParetoFront', () => {
    it('should select up to 3 Pareto optimal solutions', () => {
      const solutions = [
        { setbackExcess: 0, totalGap: 0.5, columns: [] },
        { setbackExcess: 0.1, totalGap: 0.3, columns: [] },
        { setbackExcess: 0.2, totalGap: 0.2, columns: [] },
        { setbackExcess: 0.3, totalGap: 0.1, columns: [] },
      ];

      const selected = service.selectParetoFront(solutions);

      expect(selected.length).toBeLessThanOrEqual(3);
      expect(selected.length).toBeGreaterThan(0);
    });

    it('should handle single solution', () => {
      const solutions = [{ setbackExcess: 0.1, totalGap: 0.2, columns: [] }];

      const selected = service.selectParetoFront(solutions);

      expect(selected.length).toBe(1);
    });

    it('should filter dominated solutions', () => {
      const solutions = [
        { setbackExcess: 0.1, totalGap: 0.1, columns: [] }, // Pareto optimal
        { setbackExcess: 0.2, totalGap: 0.2, columns: [] }, // Dominated
        { setbackExcess: 0.3, totalGap: 0.05, columns: [] }, // Pareto optimal
      ];

      const selected = service.selectParetoFront(solutions);

      // Should not include the dominated solution
      expect(selected).not.toContainEqual(
        expect.objectContaining({ setbackExcess: 0.2, totalGap: 0.2 }),
      );
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
      expect(result.scenarios.length).toBeLessThanOrEqual(3);

      for (const scenario of result.scenarios) {
        expect(scenario.setback).toBeGreaterThanOrEqual(0.15);
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
      // Tent width 8m - setback 0.3m = 7.7m usable width
      // 2x1 brace: 7 columns of 1m width (normal) = 7m, excess = 0.7m > 0.5m threshold
      // Need 8 columns = 8m, but 8 > 7.7m, so we need to use tent that allows combinations
      // Actually: 6m of columns with 0.7m excess (not valid), or
      // Better: Use larger tent where columns can fit within threshold
      const result = service.calculate({
        tent: { length: 10, width: 8 },
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
        expect(scenario.setback).toBeGreaterThanOrEqual(0.15);
      }
    });

    it('should produce scenarios with different characteristics', () => {
      const result = service.calculate({
        tent: { length: 20, width: 12 },
      });

      if (result.scenarios.length >= 2) {
        const [first, second] = result.scenarios;
        // Scenarios should have different setback or gap values
        const isDifferent =
          first.setback !== second.setback || first.totalGap !== second.totalGap;
        expect(isDifferent).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle tent where braces exactly fit width', () => {
      // 2 x 1.22m braces + 3 x 0.05m rails + 2 x 0.15m setback = 2.89m total
      const result = service.calculate({
        tent: { length: 10, width: 2.89 },
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
});
