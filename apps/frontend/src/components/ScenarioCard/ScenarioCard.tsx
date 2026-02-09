import { useTranslation } from 'react-i18next';
import type { Scenario } from '../../types';
import styles from './ScenarioCard.module.scss';

interface ScenarioCardProps {
  scenario: Scenario;
  isSelected: boolean;
  onSelect: () => void;
}

export function ScenarioCard({
  scenario,
  isSelected,
  onSelect,
}: ScenarioCardProps) {
  const { t } = useTranslation();
  const formatNumber = (n: number): string => {
    return n.toFixed(3).replace(/\.?0+$/, '');
  };

  const columnCount = scenario.columns.length;
  const braceCount = scenario.columns.reduce(
    (sum, col) => sum + col.columnType.braceCount,
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
        <h4 className={styles.name}>{scenario.name}</h4>

        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricValue}>{formatNumber(scenario.setback)}</span>
            <span className={styles.metricLabel}>{t('results.setback')}</span>
          </div>
          <div className={styles.metricDivider} />
          <div className={styles.metric}>
            <span className={styles.metricValue}>{columnCount}</span>
            <span className={styles.metricLabel}>{t('results.columns')}</span>
          </div>
          <div className={styles.metricDivider} />
          <div className={styles.metric}>
            <span className={styles.metricValue}>{braceCount}</span>
            <span className={styles.metricLabel}>{t('results.braces')}</span>
          </div>
        </div>

        <div className={styles.usable}>
          <span className={styles.usableLabel}>{t('results.usable')}</span>
          <span className={styles.usableValue}>
            {formatNumber(scenario.usableLength)} × {formatNumber(scenario.usableWidth)}m
          </span>
        </div>
      </div>
    </button>
  );
}
