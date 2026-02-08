import { useState } from 'react';
import type { Inventory, Brace, Rail } from '../../types';
import { Button } from '../Button';
import styles from './InventoryEditor.module.scss';

interface InventoryEditorProps {
  inventory: Inventory;
  onChange: (inventory: Inventory) => void;
  disabled?: boolean;
}

export function InventoryEditor({
  inventory,
  onChange,
  disabled,
}: InventoryEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateBrace = (index: number, field: keyof Brace, value: number) => {
    const newBraces = [...inventory.braces];
    newBraces[index] = { ...newBraces[index], [field]: value };
    onChange({ ...inventory, braces: newBraces });
  };

  const addBrace = () => {
    onChange({
      ...inventory,
      braces: [...inventory.braces, { length: 2, width: 1, quantity: 100 }],
    });
  };

  const removeBrace = (index: number) => {
    const newBraces = inventory.braces.filter((_, i) => i !== index);
    onChange({ ...inventory, braces: newBraces });
  };

  const updateRail = (index: number, field: keyof Rail, value: number) => {
    const newRails = [...inventory.rails];
    newRails[index] = { ...newRails[index], [field]: value };
    onChange({ ...inventory, rails: newRails });
  };

  const addRail = () => {
    onChange({
      ...inventory,
      rails: [...inventory.rails, { length: 1, quantity: 100 }],
    });
  };

  const removeRail = (index: number) => {
    const newRails = inventory.rails.filter((_, i) => i !== index);
    onChange({ ...inventory, rails: newRails });
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <h3>Inventory</h3>
        <span className={styles.toggle}>{isExpanded ? '−' : '+'}</span>
      </button>

      {isExpanded && (
        <div className={styles.content}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>Braces (Floor Panels)</h4>
              <Button
                size="small"
                variant="secondary"
                onClick={addBrace}
                disabled={disabled}
              >
                Add
              </Button>
            </div>
            <div className={styles.items}>
              {inventory.braces.map((brace, index) => (
                <div key={index} className={styles.item}>
                  <div className={styles.itemFields}>
                    <input
                      type="number"
                      min="0.1"
                      step="0.01"
                      value={brace.length}
                      onChange={(e) =>
                        updateBrace(index, 'length', parseFloat(e.target.value))
                      }
                      disabled={disabled}
                      placeholder="Length"
                    />
                    <span>×</span>
                    <input
                      type="number"
                      min="0.1"
                      step="0.01"
                      value={brace.width}
                      onChange={(e) =>
                        updateBrace(index, 'width', parseFloat(e.target.value))
                      }
                      disabled={disabled}
                      placeholder="Width"
                    />
                    <span>m</span>
                    <input
                      type="number"
                      min="1"
                      value={brace.quantity}
                      onChange={(e) =>
                        updateBrace(index, 'quantity', parseInt(e.target.value))
                      }
                      disabled={disabled}
                      placeholder="Qty"
                      className={styles.qtyInput}
                    />
                  </div>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeBrace(index)}
                    disabled={disabled || inventory.braces.length <= 1}
                    type="button"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>Rails</h4>
              <Button
                size="small"
                variant="secondary"
                onClick={addRail}
                disabled={disabled}
              >
                Add
              </Button>
            </div>
            <div className={styles.items}>
              {inventory.rails.map((rail, index) => (
                <div key={index} className={styles.item}>
                  <div className={styles.itemFields}>
                    <input
                      type="number"
                      min="0.1"
                      step="0.01"
                      value={rail.length}
                      onChange={(e) =>
                        updateRail(index, 'length', parseFloat(e.target.value))
                      }
                      disabled={disabled}
                      placeholder="Length"
                    />
                    <span>m</span>
                    <input
                      type="number"
                      min="1"
                      value={rail.quantity}
                      onChange={(e) =>
                        updateRail(index, 'quantity', parseInt(e.target.value))
                      }
                      disabled={disabled}
                      placeholder="Qty"
                      className={styles.qtyInput}
                    />
                  </div>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeRail(index)}
                    disabled={disabled || inventory.rails.length <= 1}
                    type="button"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
