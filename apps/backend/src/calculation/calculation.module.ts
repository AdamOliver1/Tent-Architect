import { Module } from '@nestjs/common';
import { CalculationController } from './calculation.controller';
import { CalculationService } from './calculation.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [CalculationController],
  providers: [CalculationService],
  exports: [CalculationService],
})
export class CalculationModule {}
