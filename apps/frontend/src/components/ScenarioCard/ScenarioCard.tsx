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
    >
      <h4 className={styles.name}>{scenario.name}</h4>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.label}>Setback</span>
          <span className={styles.value}>{formatNumber(scenario.setback)}m</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>Columns</span>
          <span className={styles.value}>{columnCount}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>Braces</span>
          <span className={styles.value}>{braceCount}</span>
        </div>
      </div>

      <div className={styles.dimensions}>
        <span>
          Usable: {formatNumber(scenario.usableLength)}m ×{' '}
          {formatNumber(scenario.usableWidth)}m
        </span>
      </div>
    </button>
  );
}
