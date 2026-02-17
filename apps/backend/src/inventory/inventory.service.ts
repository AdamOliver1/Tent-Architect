import { Injectable } from '@nestjs/common';
import { Inventory, Brace, Rail } from '../shared/types';

/**
 * Default braces available in the inventory
 */
export const DEFAULT_BRACES: Brace[] = [
  { length: 2.45, width: 1.22, quantity: Infinity },
  { length: 2.0, width: 1.0, quantity: Infinity },
  { length: 0.5, width: 2.0, quantity: Infinity },
  { length: 0.6, width: 2.44, quantity: Infinity },
  { length: 0.4, width: 2.0, quantity: Infinity },
];

/**
 * Default rails available in the inventory
 */
export const DEFAULT_RAILS: Rail[] = [
  { length: 1.0, quantity: Infinity },
  { length: 2.0, quantity: Infinity },
  { length: 3.0, quantity: Infinity },
  { length: 4.0, quantity: Infinity },
  { length: 5.0, quantity: Infinity },
  { length: 7.36, quantity: Infinity },
];

@Injectable()
export class InventoryService {
  /**
   * Get the default inventory
   */
  getDefaultInventory(): Inventory {
    return {
      braces: DEFAULT_BRACES.map((b) => ({ ...b })),
      rails: DEFAULT_RAILS.map((r) => ({ ...r })),
    };
  }

  /**
   * Merge user-provided inventory with defaults
   * If user provides inventory, use it; otherwise use defaults
   */
  mergeWithDefaults(userInventory?: Partial<Inventory>): Inventory {
    const defaultInventory = this.getDefaultInventory();

    if (!userInventory) {
      return defaultInventory;
    }

    return {
      braces:
        userInventory.braces && userInventory.braces.length > 0
          ? userInventory.braces
          : defaultInventory.braces,
      rails:
        userInventory.rails && userInventory.rails.length > 0
          ? userInventory.rails
          : defaultInventory.rails,
    };
  }

  /**
   * Validate inventory has at least one usable brace and rail
   */
  validateInventory(inventory: Inventory): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!inventory.braces || inventory.braces.length === 0) {
      errors.push('At least one brace type is required');
    } else {
      inventory.braces.forEach((brace, index) => {
        if (brace.length <= 0 || brace.width <= 0) {
          errors.push(`Brace ${index + 1}: dimensions must be positive`);
        }
        if (brace.quantity <= 0) {
          errors.push(`Brace ${index + 1}: quantity must be positive`);
        }
      });
    }

    if (!inventory.rails || inventory.rails.length === 0) {
      errors.push('At least one rail type is required');
    } else {
      inventory.rails.forEach((rail, index) => {
        if (rail.length <= 0) {
          errors.push(`Rail ${index + 1}: length must be positive`);
        }
        if (rail.quantity <= 0) {
          errors.push(`Rail ${index + 1}: quantity must be positive`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
