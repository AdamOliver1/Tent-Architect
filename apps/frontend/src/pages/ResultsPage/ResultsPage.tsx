import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCalculation } from '../../context/CalculationContext';
import { ScenarioCard } from '../../components/ScenarioCard';
import { FloorPlanCanvas } from '../../components/FloorPlanCanvas';
import { ExportModal } from '../../components/ExportModal';
import { Button } from '../../components/Button';
import type { Column } from '../../types';
import styles from './ResultsPage.module.scss';

function formatNum(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, '');
}

export function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { results, tent } = useCalculation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<{
    column: Column;
    index: number;
    rect: DOMRect;
  } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!results || results.length === 0) {
      navigate('/');
    }
  }, [results, navigate]);

  // Close popup on outside click
  useEffect(() => {
    if (!selectedColumn) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelectedColumn(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [selectedColumn]);

  // Close popup when scenario changes
  useEffect(() => {
    setSelectedColumn(null);
  }, [selectedIndex]);

  const handleColumnClick = useCallback(
    (column: Column, index: number, rect: DOMRect) => {
      if (selectedColumn?.index === index) {
        setSelectedColumn(null);
        return;
      }
      setSelectedColumn({ column, index, rect });
    },
    [selectedColumn]
  );

  if (!results || results.length === 0) {
    return null;
  }

  const selectedScenario = results[selectedIndex];

  // Calculate popup position relative to viz container
  const getPopupStyle = (): React.CSSProperties => {
    if (!selectedColumn || !vizRef.current) return { display: 'none' };
    const vizRect = vizRef.current.getBoundingClientRect();
    const colRect = selectedColumn.rect;

    let left = colRect.right - vizRect.left + 12;
    let top = colRect.top - vizRect.top;

    if (left + 260 > vizRect.width) {
      left = colRect.left - vizRect.left - 272;
    }
    if (top < 0) top = 8;
    if (top + 200 > vizRect.height) top = vizRect.height - 200;

    return { left, top };
  };

  return (
    <div className={styles.page}>
      {/* ── Top toolbar (floating) ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.scenarioMeta}>
            <h1 className={styles.scenarioName}>{selectedScenario.name}</h1>
            <span className={styles.tentDims}>
              {tent.length}m × {tent.width}m
            </span>
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {/* Scenario toggle */}
          <button
            className={styles.panelToggle}
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            type="button"
            aria-label={isPanelOpen ? 'Hide scenarios' : 'Show scenarios'}
            title={isPanelOpen ? 'Hide scenarios' : 'Show scenarios'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="3" width="5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="10" y="3" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>

          {/* Export button — prominent, always visible */}
          <Button
            variant="accent"
            size="medium"
            onClick={() => setIsExportOpen(true)}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12v2h12v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            {t('export.exportBtn')}
          </Button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className={styles.layout}>
        {/* Scenario side panel */}
        <aside className={`${styles.panel} ${isPanelOpen ? styles.panelOpen : styles.panelClosed}`}>
          <div className={styles.panelHeader}>
            <h2>{t('results.scenarios')}</h2>
            <span className={styles.panelCount}>{results.length}</span>
          </div>
          <div className={styles.panelList}>
            {results.map((scenario, index) => (
              <ScenarioCard
                key={index}
                scenario={scenario}
                isSelected={index === selectedIndex}
                onSelect={() => setSelectedIndex(index)}
              />
            ))}
          </div>

          {/* Summary stats */}
          <div className={styles.panelStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('results.columns')}</span>
              <span className={styles.statValue}>{selectedScenario.columns.length}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('results.braces')}</span>
              <span className={styles.statValue}>
                {selectedScenario.columns.reduce(
                  (sum, col) => sum + col.columnType.braceCount, 0
                )}
              </span>
            </div>
          </div>
        </aside>

        {/* ── Canvas area — the hero ── */}
        <div className={styles.canvasArea} ref={vizRef}>
          <FloorPlanCanvas
            scenario={selectedScenario}
            tent={tent}
            onColumnClick={handleColumnClick}
            selectedColumnIndex={selectedColumn?.index ?? null}
          />

          {/* Column detail popup */}
          {selectedColumn && (
            <div
              ref={popupRef}
              className={styles.columnPopup}
              style={getPopupStyle()}
              role="dialog"
              aria-label={`${t('results.columnNumber')} ${selectedColumn.index + 1} ${t('results.columnDetails')}`}
            >
              <div className={styles.popupHeader}>
                <h4>
                  <span className={styles.popupBadge}>{selectedColumn.index + 1}</span>
                  {t('results.columnNumber')} {selectedColumn.index + 1}
                </h4>
                <button
                  className={styles.popupClose}
                  onClick={() => setSelectedColumn(null)}
                  aria-label={t('results.close')}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <dl className={styles.popupDetails}>
                <div className={styles.popupRow}>
                  <dt>{t('results.braceSize')}</dt>
                  <dd>
                    {formatNum(selectedColumn.column.columnType.braceLength)}m ×{' '}
                    {formatNum(selectedColumn.column.columnType.braceWidth)}m
                  </dd>
                </div>
                <div className={styles.popupRow}>
                  <dt>{t('results.braces')}</dt>
                  <dd>{selectedColumn.column.columnType.braceCount}</dd>
                </div>
                {selectedColumn.column.columnType.rotated && (
                  <div className={styles.popupRow}>
                    <dt>{t('results.orientation')}</dt>
                    <dd>{t('results.rotated')}</dd>
                  </div>
                )}
                <div className={styles.popupRow}>
                  <dt>{t('results.columnWidth')}</dt>
                  <dd>{formatNum(selectedColumn.column.columnType.columnWidth)}m</dd>
                </div>
                <div className={styles.popupRow}>
                  <dt>{t('results.fillLength')}</dt>
                  <dd>{formatNum(selectedColumn.column.columnType.fillLength)}m</dd>
                </div>
                {selectedColumn.column.columnType.gap > 0.001 && (
                  <div className={`${styles.popupRow} ${styles.popupRowGap}`}>
                    <dt>{t('results.gap')}</dt>
                    <dd>{formatNum(selectedColumn.column.columnType.gap)}m</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* ── Export Modal ── */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        projectName={`${selectedScenario.name} — ${tent.length}m × ${tent.width}m`}
      />
    </div>
  );
}
