import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Scenario, Inventory } from '../../types';
import { Button } from '../Button';
import styles from './ScenarioInventoryModal.module.scss';

interface ScenarioInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: Scenario;
  inventory: Inventory | null;
  braceColorMap: Record<string, string>;
}

function formatNum(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, '');
}

// Translate scenario names from backend English to current locale
function translateScenarioName(name: string, t: (key: string) => string): string {
  const baseNames = [
    'Best Width Fit', 'Least Brace Kinds', 'Minimum Gaps',
    'Least Rails', 'Least Braces', 'Biggest Braces', 'Balanced', 'Option',
  ];
  for (const base of baseNames) {
    if (name === base) return t(`results.scenarioNames.${base}`);
    if (name.startsWith(base + ' ')) {
      const suffix = name.slice(base.length + 1);
      return `${t(`results.scenarioNames.${base}`)} ${suffix}`;
    }
  }
  return name;
}

export function ScenarioInventoryModal({
  isOpen,
  onClose,
  scenario,
  inventory: _inventory,
  braceColorMap,
}: ScenarioInventoryModalProps) {
  void _inventory; // Props kept for interface compatibility; rails come from scenario.rails
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  if (!isOpen) return null;

  // Aggregate brace usage from scenario columns (handles mixed columns)
  const braceUsage = new Map<string, { length: number; width: number; count: number; rotated: boolean }>();
  for (const col of scenario.columns) {
    const ct = col.columnType;
    if (ct.bracePlacements) {
      // Mixed column: aggregate each placement type
      for (const bp of ct.bracePlacements) {
        const key = `${bp.braceLength}×${bp.braceWidth}`;
        const existing = braceUsage.get(key);
        if (existing) {
          existing.count += bp.count;
        } else {
          braceUsage.set(key, {
            length: bp.braceLength,
            width: bp.braceWidth,
            count: bp.count,
            rotated: bp.rotated,
          });
        }
      }
    } else {
      const key = `${ct.braceLength}×${ct.braceWidth}`;
      const existing = braceUsage.get(key);
      if (existing) {
        existing.count += ct.braceCount;
      } else {
        braceUsage.set(key, {
          length: ct.braceLength,
          width: ct.braceWidth,
          count: ct.braceCount,
          rotated: ct.rotated,
        });
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={handleBackdropClick}
      aria-label={t('results.inventoryDetails')}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{t('results.inventoryDetails')}</h2>
            <p className={styles.subtitle}>{translateScenarioName(scenario.name, t)}</p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('results.close')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Setbacks section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('results.setback')}</h3>
            <div className={styles.statGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t('results.railEndSetback')} (L)</span>
                <span className={styles.statValue}>{formatNum(scenario.setback)}m</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t('results.railEndSetback')} (R)</span>
                <span className={styles.statValue}>{formatNum(scenario.setback)}m</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t('results.openEndSetbackStart')}</span>
                <span className={styles.statValue}>{formatNum(scenario.openEndSetbackStart)}m</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t('results.openEndSetbackEnd')}</span>
                <span className={styles.statValue}>{formatNum(scenario.openEndSetbackEnd)}m</span>
              </div>
            </div>
          </div>

          {/* Brace usage section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              {t('results.braces')}
              <span className={styles.badge}>{scenario.distinctBraceTypes} {t('results.braceKinds').toLowerCase()}</span>
            </h3>
            <div className={styles.braceList}>
              {Array.from(braceUsage.entries()).map(([key, usage]) => {
                const colorKey = `${usage.length}×${usage.width}`;
                const color = braceColorMap[colorKey] || '#5A7A6C';
                return (
                  <div key={key} className={styles.braceItem}>
                    <span className={styles.braceSwatch} style={{ backgroundColor: color }} />
                    <div className={styles.braceInfo}>
                      <span className={styles.braceSize}>
                        {formatNum(usage.length)}m × {formatNum(usage.width)}m
                        {usage.rotated && <span className={styles.rotatedTag}>{t('results.rotated')}</span>}
                      </span>
                      <span className={styles.braceCount}>×{usage.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('results.columnDetails')}</h3>
            <div className={styles.statGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t('results.columns')}</span>
                <span className={styles.statValue}>{scenario.columns.length}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t('results.braces')}</span>
                <span className={styles.statValue}>
                  {scenario.columns.reduce((sum, col) => sum + col.columnType.braceCount, 0)}
                </span>
              </div>
              {scenario.totalGap > 0.001 && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>{t('results.totalGap')}</span>
                  <span className={styles.statValue}>{formatNum(scenario.totalGap)}m</span>
                </div>
              )}
            </div>
          </div>

          {/* Used rails from scenario */}
          {scenario.rails && scenario.rails.length > 0 && (() => {
            // Aggregate rail segments by length across all rail tracks
            const railUsage = new Map<number, number>();
            for (const track of scenario.rails) {
              for (const segment of track) {
                const existing = railUsage.get(segment.length) || 0;
                railUsage.set(segment.length, existing + 1);
              }
            }
            const railEntries = Array.from(railUsage.entries()).sort((a, b) => b[0] - a[0]);
            const totalSegments = railEntries.reduce((sum, [, count]) => sum + count, 0);

            return (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  {t('inventory.rails')}
                  <span className={styles.badge}>{totalSegments} {t('inventory.rails').toLowerCase()}</span>
                </h3>
                <div className={styles.braceList}>
                  {railEntries.map(([length, count]) => (
                    <div key={length} className={styles.braceItem}>
                      <span className={styles.braceSwatch} style={{ backgroundColor: '#4A5553' }} />
                      <div className={styles.braceInfo}>
                        <span className={styles.braceSize}>
                          {formatNum(length)}m
                        </span>
                        <span className={styles.braceCount}>×{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            {t('results.close')}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
