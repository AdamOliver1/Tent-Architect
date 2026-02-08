import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CalculationService } from './calculation.service';
import { CalculateRequestDto, CalculateResponseDto } from './dto';

@Controller('api')
export class CalculationController {
  constructor(private readonly calculationService: CalculationService) {}

  /**
   * Calculate floor plan scenarios for given tent dimensions
   *
   * @param request - Tent dimensions and optional custom inventory
   * @returns Up to 3 optimized floor plan scenarios
   */
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculate(@Body() request: CalculateRequestDto): CalculateResponseDto {
    return this.calculationService.calculate(request);
  }
}
