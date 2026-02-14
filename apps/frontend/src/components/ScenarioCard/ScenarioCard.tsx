import { useTranslation } from 'react-i18next';
import type { Scenario } from '../../types';
import styles from './ScenarioCard.module.scss';

interface ScenarioCardProps {
  scenario: Scenario;
  isSelected: boolean;
  onSelect: () => void;
  onInventoryClick: () => void;
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

export function ScenarioCard({
  scenario,
  isSelected,
  onSelect,
  onInventoryClick,
}: ScenarioCardProps) {
  const { t } = useTranslation();
  const formatNumber = (n: number): string => {
    return n.toFixed(3).replace(/\.?0+$/, '');
  };

  const braceCount = scenario.columns.reduce(
    (sum, col) => sum + col.columnType.braceCount,
    0
  );

  // Calculate max gap from all columns
  const maxGap = scenario.columns.reduce(
    (max, col) => Math.max(max, col.columnType.gap || 0),
    0
  );

  return (
    <button
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
      type="button"
      aria-pressed={isSelected}
    >
      {/* Selection indicator */}
      <div className={styles.indicator} aria-hidden="true" />

      <div className={styles.body}>
        <h4 className={styles.name}>{translateScenarioName(scenario.name, t)}</h4>

        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricValue}>{formatNumber(scenario.setback)}</span>
            <span className={styles.metricLabel}>{t('results.setback')}</span>
          </div>
          <div className={styles.metricDivider} />
          <div className={styles.metric}>
            <span className={styles.metricValue}>{scenario.columns.length}</span>
            <span className={styles.metricLabel}>{t('results.columns')}</span>
          </div>
          <div className={styles.metricDivider} />
          <div className={styles.metric}>
            <span className={styles.metricValue}>{braceCount}</span>
            <span className={styles.metricLabel}>{t('results.braces')}</span>
          </div>
          <div className={styles.metricDivider} />
          <div className={styles.metric}>
            <span className={styles.metricValue}>{formatNumber(maxGap)}</span>
            <span className={styles.metricLabel}>{t('results.maxGap')}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <span
            className={styles.inventoryBtn}
            onClick={(e) => {
              e.stopPropagation();
              onInventoryClick();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onInventoryClick();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={t('results.inventoryBtn')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 3h10M2 7h10M2 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t('results.inventoryBtn')}
          </span>
        </div>
      </div>
    </button>
  );
}
