import { Module } from '@nestjs/common';
import { CalculationModule } from './calculation/calculation.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [CalculationModule, InventoryModule],
})
export class AppModule {}
