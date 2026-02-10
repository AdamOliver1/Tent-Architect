import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        aria-expanded={isExpanded}
      >
        <div className={styles.headerLeft}>
          <svg
            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3>{t('inventory.title')}</h3>
        </div>
        <span className={styles.badge}>
          {inventory.braces.length} {t('inventory.braces').toLowerCase()} · {inventory.rails.length} {t('inventory.rails').toLowerCase()}
        </span>
      </button>

      {isExpanded && (
        <div className={styles.content}>
          {/* Braces section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>{t('inventory.braces')}</h4>
              <Button
                size="small"
                variant="ghost"
                onClick={addBrace}
                disabled={disabled}
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              >
                {t('inventory.add')}
              </Button>
            </div>
            <div className={styles.items}>
              {inventory.braces.map((brace, index) => (
                <div key={index} className={styles.item}>
                  <div className={styles.itemFields}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.microLabel}>{t('tent.length')}</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.01"
                        value={brace.length}
                        onChange={(e) =>
                          updateBrace(index, 'length', parseFloat(e.target.value))
                        }
                        disabled={disabled}
                      />
                    </div>
                    <span className={styles.times}>×</span>
                    <div className={styles.fieldGroup}>
                      <label className={styles.microLabel}>{t('tent.width')}</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.01"
                        value={brace.width}
                        onChange={(e) =>
                          updateBrace(index, 'width', parseFloat(e.target.value))
                        }
                        disabled={disabled}
                      />
                    </div>
                    <span className={styles.unitLabel}>m</span>
                    <div className={styles.fieldGroup}>
                      <label className={styles.microLabel}>{t('inventory.quantity')}</label>
                      <input
                        type="number"
                        min="1"
                        value={brace.quantity}
                        onChange={(e) =>
                          updateBrace(index, 'quantity', parseInt(e.target.value))
                        }
                        disabled={disabled}
                        className={styles.qtyInput}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.microLabel}>{t('inventory.color')}</label>
                      <input
                        type="color"
                        value={brace.color || '#5A7A6C'}
                        onChange={(e) => {
                          const newBraces = [...inventory.braces];
                          newBraces[index] = { ...newBraces[index], color: e.target.value };
                          onChange({ ...inventory, braces: newBraces });
                        }}
                        disabled={disabled}
                        className={styles.colorInput}
                        title={t('inventory.color')}
                      />
                    </div>
                  </div>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeBrace(index)}
                    disabled={disabled || inventory.braces.length <= 1}
                    type="button"
                    title={t('inventory.remove')}
                    aria-label={`${t('inventory.remove')} brace ${index + 1}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Rails section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>{t('inventory.rails')}</h4>
              <Button
                size="small"
                variant="ghost"
                onClick={addRail}
                disabled={disabled}
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              >
                {t('inventory.add')}
              </Button>
            </div>
            <div className={styles.items}>
              {inventory.rails.map((rail, index) => (
                <div key={index} className={styles.item}>
                  <div className={styles.itemFields}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.microLabel}>{t('tent.length')}</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.01"
                        value={rail.length}
                        onChange={(e) =>
                          updateRail(index, 'length', parseFloat(e.target.value))
                        }
                        disabled={disabled}
                      />
                    </div>
                    <span className={styles.unitLabel}>m</span>
                    <div className={styles.fieldGroup}>
                      <label className={styles.microLabel}>{t('inventory.quantity')}</label>
                      <input
                        type="number"
                        min="1"
                        value={rail.quantity}
                        onChange={(e) =>
                          updateRail(index, 'quantity', parseInt(e.target.value))
                        }
                        disabled={disabled}
                        className={styles.qtyInput}
                      />
                    </div>
                  </div>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeRail(index)}
                    disabled={disabled || inventory.rails.length <= 1}
                    type="button"
                    title={t('inventory.remove')}
                    aria-label={`${t('inventory.remove')} rail ${index + 1}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
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
