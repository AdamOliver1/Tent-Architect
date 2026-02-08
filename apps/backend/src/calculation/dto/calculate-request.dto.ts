import {
  IsNumber,
  IsPositive,
  IsOptional,
  ValidateNested,
  IsArray,
  Min,
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
}
