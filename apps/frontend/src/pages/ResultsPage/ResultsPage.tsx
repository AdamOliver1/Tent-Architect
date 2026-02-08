import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCalculation } from '../../context/CalculationContext';
import { ScenarioCard } from '../../components/ScenarioCard';
import { FloorPlanCanvas } from '../../components/FloorPlanCanvas';
import { Button } from '../../components/Button';
import type { Column } from '../../types';
import styles from './ResultsPage.module.scss';

function formatNum(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, '');
}

export function ResultsPage() {
  const navigate = useNavigate();
  const { results, tent } = useCalculation();
  const [selectedIndex, setSelectedIndex] = useState(0);
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
      // If clicking the same column, toggle off
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

  // Calculate popup position relative to the visualization container
  const getPopupStyle = (): React.CSSProperties => {
    if (!selectedColumn || !vizRef.current) return { display: 'none' };
    const vizRect = vizRef.current.getBoundingClientRect();
    const colRect = selectedColumn.rect;

    let left = colRect.right - vizRect.left + 12;
    let top = colRect.top - vizRect.top;

    // If popup would go off right edge, put it on the left side
    if (left + 240 > vizRect.width) {
      left = colRect.left - vizRect.left - 252;
    }
    // Clamp top
    if (top < 0) top = 8;
    if (top + 200 > vizRect.height) top = vizRect.height - 200;

    return { left, top };
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Back to Dashboard
        </Button>
        <h1>Floor Plan Results</h1>
        <div className={styles.tentInfo}>
          {tent.length}m x {tent.width}m
        </div>
      </header>

      <main className={styles.main}>
        <aside className={styles.scenarios}>
          <h2>Scenarios</h2>
          <div className={styles.scenarioList}>
            {results.map((scenario, index) => (
              <ScenarioCard
                key={index}
                scenario={scenario}
                isSelected={index === selectedIndex}
                onSelect={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        </aside>

        <div className={styles.visualization} ref={vizRef}>
          <div className={styles.vizHeader}>
            <h2>{selectedScenario.name}</h2>
            <span className={styles.vizSubtitle}>
              {selectedScenario.columns.length} columns &middot;{' '}
              {selectedScenario.columns.reduce(
                (sum, col) => sum + col.columnType.braceCount,
                0
              )}{' '}
              braces
            </span>
          </div>

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
              aria-label={`Column ${selectedColumn.index + 1} details`}
            >
              <div className={styles.popupHeader}>
                <h4>Column {selectedColumn.index + 1}</h4>
                <button
                  className={styles.popupClose}
                  onClick={() => setSelectedColumn(null)}
                  aria-label="Close column details"
                >
                  &times;
                </button>
              </div>
              <dl className={styles.popupDetails}>
                <div className={styles.popupRow}>
                  <dt>Brace size</dt>
                  <dd>
                    {formatNum(selectedColumn.column.columnType.braceLength)}m &times;{' '}
                    {formatNum(selectedColumn.column.columnType.braceWidth)}m
                  </dd>
                </div>
                <div className={styles.popupRow}>
                  <dt>Braces</dt>
                  <dd>{selectedColumn.column.columnType.braceCount}</dd>
                </div>
                {selectedColumn.column.columnType.rotated && (
                  <div className={styles.popupRow}>
                    <dt>Orientation</dt>
                    <dd>Rotated</dd>
                  </div>
                )}
                <div className={styles.popupRow}>
                  <dt>Column width</dt>
                  <dd>{formatNum(selectedColumn.column.columnType.columnWidth)}m</dd>
                </div>
                <div className={styles.popupRow}>
                  <dt>Fill length</dt>
                  <dd>{formatNum(selectedColumn.column.columnType.fillLength)}m</dd>
                </div>
                {selectedColumn.column.columnType.gap > 0.001 && (
                  <div className={`${styles.popupRow} ${styles.popupRowGap}`}>
                    <dt>Gap</dt>
                    <dd>{formatNum(selectedColumn.column.columnType.gap)}m</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
