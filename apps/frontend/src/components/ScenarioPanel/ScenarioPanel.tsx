import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Scenario } from '../../types';
import { ScenarioCard } from '../ScenarioCard';
import { SortBar } from './SortBar';
import type { SortOption, SortDirection } from './SortBar';
import styles from './ScenarioPanel.module.scss';

function getBraceCount(scenario: Scenario): number {
  return scenario.columns.reduce((sum, col) => sum + col.columnType.braceCount, 0);
}

function formatNum(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, '');
}

interface ScenarioPanelProps {
  results: Scenario[];
  selectedIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectScenario: (originalIndex: number) => void;
  onInventoryClick: (originalIndex: number) => void;
}

export function ScenarioPanel({
  results,
  selectedIndex,
  isOpen,
  onClose,
  onSelectScenario,
  onInventoryClick,
}: ScenarioPanelProps) {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const sortedScenarios = useMemo(() => {
    const indexed = results.map((scenario, originalIndex) => ({ scenario, originalIndex }));
    if (sortBy === 'default') return indexed;

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...indexed].sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case 'gap': diff = a.scenario.totalGap - b.scenario.totalGap; break;
        case 'setback': diff = a.scenario.setback - b.scenario.setback; break;
        case 'braces': diff = getBraceCount(a.scenario) - getBraceCount(b.scenario); break;
        case 'columns': diff = a.scenario.columns.length - b.scenario.columns.length; break;
      }
      return diff * dir;
    });
  }, [results, sortBy, sortDir]);

  const selectedScenario = results[selectedIndex];

  return (
    <>
      {/* Mobile overlay: tap to close panel */}
      <div
        role="button"
        tabIndex={-1}
        className={`${styles.overlay} ${isOpen ? styles.overlayVisible : ''}`}
        aria-hidden={!isOpen}
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      />

      <aside
        className={`${styles.panel} ${isOpen ? styles.panelOpen : styles.panelClosed}`}
        aria-hidden={!isOpen}
      >
        <div className={styles.panelHeader}>
          <h2>{t('results.scenarios')}</h2>
          <div className={styles.panelHeaderActions}>
            <span className={styles.panelCount}>{results.length}</span>
            <button
              type="button"
              className={styles.panelCloseBtn}
              onClick={onClose}
              aria-label={t('results.closePanel')}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <SortBar
          sortBy={sortBy}
          sortDir={sortDir}
          onSortByChange={setSortBy}
          onSortDirToggle={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
        />

        <div className={styles.panelList}>
          {sortedScenarios.map(({ scenario, originalIndex }) => (
            <ScenarioCard
              key={originalIndex}
              scenario={scenario}
              isSelected={originalIndex === selectedIndex}
              onSelect={() => onSelectScenario(originalIndex)}
              onInventoryClick={() => onInventoryClick(originalIndex)}
            />
          ))}
        </div>

        <div className={styles.panelStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>{t('results.railEndSetback')}</span>
            <span className={styles.statValue}>{formatNum(selectedScenario.setback)}m</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>{t('results.openEndSetbackStart')}</span>
            <span className={styles.statValue}>{formatNum(selectedScenario.openEndSetbackStart)}m</span>
          </div>
        </div>
      </aside>
    </>
  );
}
