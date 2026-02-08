import { Scenario, TentDimensions } from '../../shared/types';

/**
 * Calculate response DTO
 */
export class CalculateResponseDto {
  /** Array of calculated scenarios (up to 3) */
  scenarios!: Scenario[];

  /** Original tent dimensions */
  tent!: TentDimensions;
}
