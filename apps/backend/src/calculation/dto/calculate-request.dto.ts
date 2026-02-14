import {
  IsNumber,
  IsPositive,
  IsOptional,
  ValidateNested,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Tent dimensions DTO
 */
export class TentDimensionsDto {
  @IsNumber()
  @IsPositive()
  length!: number;

  @IsNumber()
  @IsPositive()
  width!: number;
}

/**
 * Brace specification DTO
 */
export class BraceDto {
  @IsNumber()
  @IsPositive()
  length!: number;

  @IsNumber()
  @IsPositive()
  width!: number;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

/**
 * Rail specification DTO
 */
export class RailDto {
  @IsNumber()
  @IsPositive()
  length!: number;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

/**
 * Inventory DTO
 */
export class InventoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BraceDto)
  @IsOptional()
  braces?: BraceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RailDto)
  @IsOptional()
  rails?: RailDto[];
}

/**
 * Algorithm constraints DTO — all optional, defaults applied in service
 */
export class ConstraintsDto {
  /** Minimum setback from tent edges in meters (default: 0.08) */
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  minSetback?: number;

  /** Maximum setback from tent edges in meters (default: 0.25) */
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  maxSetback?: number;

  /** Maximum allowed gap per column in meters (default: 0.39) */
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  maxColumnGap?: number;
}

/**
 * Calculate request DTO
 */
export class CalculateRequestDto {
  @ValidateNested()
  @Type(() => TentDimensionsDto)
  tent!: TentDimensionsDto;

  @ValidateNested()
  @Type(() => InventoryDto)
  @IsOptional()
  inventory?: InventoryDto;

  @ValidateNested()
  @Type(() => ConstraintsDto)
  @IsOptional()
  constraints?: ConstraintsDto;
}
