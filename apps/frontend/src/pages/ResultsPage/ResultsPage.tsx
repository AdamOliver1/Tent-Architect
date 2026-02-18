import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCalculation } from '../../context/CalculationContext';
import { ScenarioPanel } from '../../components/ScenarioPanel';
import { FloorPlanCanvas } from '../../components/FloorPlanCanvas';
import { ExportModal } from '../../components/ExportModal';
import { ScenarioInventoryModal } from '../../components/ScenarioInventoryModal';
import { ColumnPopup } from '../../components/ColumnPopup';
import { Button } from '../../components/Button';
import type { Column } from '../../types';
import styles from './ResultsPage.module.scss';

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

export function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { results, tent, inventory } = useCalculation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Desktop: panel open by default. Mobile: closed, opened via "Choose layout" button
  const [isPanelOpen, setIsPanelOpen] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? false : true
  );
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [inventoryModalScenarioIndex, setInventoryModalScenarioIndex] = useState(0);
  const [selectedColumn, setSelectedColumn] = useState<{
    column: Column;
    index: number;
    rect: DOMRect;
    mousePos?: { x: number; y: number };
  } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<HTMLDivElement>(null);

  // Track mobile viewport to auto-close panel after scenario selection
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = () => setIsMobileView(mq.matches);
    mq.addEventListener('change', handler);
    handler();
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleSelectScenario = useCallback(
    (originalIndex: number) => {
      setSelectedIndex(originalIndex);
      if (isMobileView) setIsPanelOpen(false);
    },
    [isMobileView]
  );

  useEffect(() => {
    if (!results || results.length === 0) navigate('/');
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
    (column: Column, index: number, rect: DOMRect, mousePos?: { x: number; y: number }) => {
      if (selectedColumn?.index === index) {
        setSelectedColumn(null);
        return;
      }
      setSelectedColumn({ column, index, rect, mousePos });
    },
    [selectedColumn]
  );

  // Build brace color map from inventory
  const braceColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (inventory) {
      for (const brace of inventory.braces) {
        if (brace.color) {
          map[`${brace.length}×${brace.width}`] = brace.color;
        }
      }
    }
    return map;
  }, [inventory]);

  if (!results || results.length === 0) return null;

  const selectedScenario = results[selectedIndex];

  // Calculate popup position relative to viz container (near mouse cursor)
  const getPopupStyle = (): React.CSSProperties => {
    if (!selectedColumn || !vizRef.current) return { display: 'none' };
    const vizRect = vizRef.current.getBoundingClientRect();
    const popupWidth = 260;
    const popupHeight = 200;
    const offset = 16;

    if (selectedColumn.mousePos) {
      let left = selectedColumn.mousePos.x - vizRect.left + offset;
      let top = selectedColumn.mousePos.y - vizRect.top + offset;

      if (left + popupWidth > vizRect.width) {
        left = selectedColumn.mousePos.x - vizRect.left - popupWidth - offset;
      }
      if (top + popupHeight > vizRect.height) {
        top = selectedColumn.mousePos.y - vizRect.top - popupHeight - offset;
      }
      if (left < 0) left = 8;
      if (top < 0) top = 8;

      return { left, top };
    }

    const colRect = selectedColumn.rect;
    let left = colRect.right - vizRect.left + 12;
    let top = colRect.top - vizRect.top;

    if (left + popupWidth > vizRect.width) {
      left = colRect.left - vizRect.left - popupWidth - 12;
    }
    if (top < 0) top = 8;
    if (top + popupHeight > vizRect.height) top = vizRect.height - popupHeight;

    return { left, top };
  };

  return (
    <div className={styles.page}>
      {/* ── Top toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.scenarioMeta}>
            <h1 className={styles.scenarioName}>{translateScenarioName(selectedScenario.name, t)}</h1>
            <span className={styles.tentDims}>
              {tent.length}m × {tent.width}m
            </span>
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {/* Mobile: "Choose layout" when panel closed */}
          <button
            className={`${styles.chooseLayoutBtn} ${!isPanelOpen ? styles.chooseLayoutBtnVisible : ''}`}
            onClick={() => setIsPanelOpen(true)}
            type="button"
            aria-label={t('results.chooseLayout')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <rect x="2" y="3" width="5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="10" y="3" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>{t('results.chooseLayout')}</span>
          </button>

          {/* Panel toggle: desktop always, mobile when panel open */}
          <button
            className={`${styles.panelToggle} ${isPanelOpen ? styles.panelToggleVisible : ''}`}
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            type="button"
            aria-label={isPanelOpen ? t('results.hideScenarios') : t('results.showScenarios')}
            title={isPanelOpen ? t('results.hideScenarios') : t('results.showScenarios')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="3" width="5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="10" y="3" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>

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
        <ScenarioPanel
          results={results}
          selectedIndex={selectedIndex}
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          onSelectScenario={handleSelectScenario}
          onInventoryClick={(idx) => {
            setInventoryModalScenarioIndex(idx);
            setIsInventoryModalOpen(true);
          }}
        />

        {/* ── Canvas area — the hero ── */}
        <div className={styles.canvasArea} ref={vizRef}>
          <FloorPlanCanvas
            scenario={selectedScenario}
            onColumnClick={handleColumnClick}
            selectedColumnIndex={selectedColumn?.index ?? null}
            braceColorMap={braceColorMap}
          />

          {selectedColumn && (
            <ColumnPopup
              popupRef={popupRef}
              column={selectedColumn.column}
              index={selectedColumn.index}
              style={getPopupStyle()}
              onClose={() => setSelectedColumn(null)}
            />
          )}
        </div>
      </div>

      {/* ── Export Modal ── */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        projectName={`${selectedScenario.name} — ${tent.length}m × ${tent.width}m`}
        scenario={selectedScenario}
        tentDimensions={{ length: tent.length, width: tent.width }}
        braceColorMap={braceColorMap}
      />

      {/* ── Scenario Inventory Modal ── */}
      <ScenarioInventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        scenario={results[inventoryModalScenarioIndex]}
        inventory={inventory}
        braceColorMap={braceColorMap}
      />
    </div>
  );
}
