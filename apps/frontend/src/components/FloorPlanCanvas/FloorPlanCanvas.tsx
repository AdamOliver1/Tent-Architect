import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { Scenario, Column, TentDimensions } from '../../types';
import styles from './FloorPlanCanvas.module.scss';

interface FloorPlanCanvasProps {
  scenario: Scenario;
  tent: TentDimensions;
  onColumnClick?: (column: Column, index: number, rect: DOMRect) => void;
  selectedColumnIndex?: number | null;
}

const RAIL_THICKNESS = 0.05; // 5cm in meters

const COLORS = {
  background: '#f1f5f9',
  tentBorder: '#94a3b8',
  setbackLine: '#cbd5e1',
  setbackFill: 'rgba(148, 163, 184, 0.06)',
  rail: '#475569',
  brace: '#3b82f6',
  braceHover: '#2563eb',
  braceBorder: '#1d4ed8',
  gap: '#fef3c7',
  gapBorder: '#f59e0b',
  text: '#475569',
  dimLine: '#94a3b8',
  labelBg: 'rgba(255,255,255,0.92)',
};

// Animation timing
const ANIM = {
  tentDelay: 0,
  setbackDelay: 200,
  railDelay: 400,
  columnBaseDelay: 600,
  columnStagger: 120,
  gapExtraDelay: 80,
  labelDelay: 200,
  duration: 400,
};

function formatDim(n: number): string {
  if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, '');
  return n.toFixed(3).replace(/\.?0+$/, '');
}

export function FloorPlanCanvas({
  scenario,
  tent,
  onColumnClick,
  selectedColumnIndex,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [animKey, setAnimKey] = useState(0);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

  // Trigger re-animation when scenario changes
  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [scenario]);

  // Responsive width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => setContainerWidth(el.clientWidth);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Layout calculation (pure math, same logic as before)
  const layout = useMemo(() => {
    const padding = 70;
    const height = Math.max(500, Math.min(containerWidth * 0.75, 800));
    const availableWidth = containerWidth - 2 * padding;
    const availableHeight = height - 2 * padding;
    const scaleX = availableWidth / tent.width;
    const scaleY = availableHeight / tent.length;
    const scale = Math.min(scaleX, scaleY);

    const tentDisplayWidth = tent.width * scale;
    const tentDisplayHeight = tent.length * scale;
    const offsetX = (containerWidth - tentDisplayWidth) / 2;
    const offsetY = (height - tentDisplayHeight) / 2;

    return { padding, height, scale, offsetX, offsetY, tentDisplayWidth, tentDisplayHeight };
  }, [containerWidth, tent]);

  const toX = useCallback((x: number) => layout.offsetX + x * layout.scale, [layout]);
  const toY = useCallback((y: number) => layout.offsetY + y * layout.scale, [layout]);
  const toS = useCallback((s: number) => s * layout.scale, [layout]);

  const handleColumnClick = useCallback(
    (column: Column, index: number, e: React.MouseEvent<SVGGElement> | React.KeyboardEvent<SVGGElement>) => {
      if (!onColumnClick) return;
      const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
      onColumnClick(column, index, rect);
    },
    [onColumnClick]
  );

  const handleColumnKeyDown = useCallback(
    (column: Column, index: number, e: React.KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleColumnClick(column, index, e);
      }
    },
    [handleColumnClick]
  );

  // Should we show dimension labels on braces? Only if braces are big enough on screen
  const showBraceLabels = useMemo(() => {
    if (scenario.columns.length === 0) return false;
    const firstCol = scenario.columns[0].columnType;
    const pixelW = toS(firstCol.columnWidth);
    const pixelH = toS(firstCol.fillLength);
    return pixelW > 40 && pixelH > 18;
  }, [scenario.columns, toS]);

  const showGapLabels = useMemo(() => {
    return scenario.columns.some((col) => {
      if (col.columnType.gap <= 0.001) return false;
      const pixelH = toS(col.columnType.gap);
      return pixelH > 14;
    });
  }, [scenario.columns, toS]);

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        key={animKey}
        width={containerWidth}
        height={layout.height}
        viewBox={`0 0 ${containerWidth} ${layout.height}`}
        className={styles.svg}
        role="img"
        aria-label={`Floor plan for ${tent.length}m by ${tent.width}m tent, ${scenario.name}`}
      >
        {/* Background */}
        <rect width={containerWidth} height={layout.height} fill={COLORS.background} />

        {/* ── Tent Outline ── */}
        <rect
          x={toX(0)}
          y={toY(0)}
          width={toS(tent.width)}
          height={toS(tent.length)}
          fill="none"
          stroke={COLORS.tentBorder}
          strokeWidth={2}
          className={styles.animFadeIn}
          style={{ animationDelay: `${ANIM.tentDelay}ms` }}
        />

        {/* ── Setback area (shaded) ── */}
        <rect
          x={toX(scenario.setback)}
          y={toY(scenario.setback)}
          width={toS(tent.width - 2 * scenario.setback)}
          height={toS(tent.length - 2 * scenario.setback)}
          fill={COLORS.setbackFill}
          stroke={COLORS.setbackLine}
          strokeWidth={1}
          strokeDasharray="6 4"
          className={styles.animFadeIn}
          style={{ animationDelay: `${ANIM.setbackDelay}ms` }}
        />

        {/* ── Setback dimension lines ── */}
        {scenario.setback > 0.15 && (
          <g
            className={styles.animFadeIn}
            style={{ animationDelay: `${ANIM.setbackDelay + 100}ms` }}
          >
            {/* Top setback dimension */}
            <line
              x1={toX(tent.width / 2) - 20}
              y1={toY(0)}
              x2={toX(tent.width / 2) - 20}
              y2={toY(scenario.setback)}
              stroke={COLORS.dimLine}
              strokeWidth={1}
              markerStart="url(#arrowUp)"
              markerEnd="url(#arrowDown)"
            />
            <rect
              x={toX(tent.width / 2) - 50}
              y={toY(scenario.setback / 2) - 9}
              width={60}
              height={18}
              rx={4}
              fill={COLORS.labelBg}
              stroke={COLORS.dimLine}
              strokeWidth={0.5}
            />
            <text
              x={toX(tent.width / 2) - 20}
              y={toY(scenario.setback / 2) + 4}
              textAnchor="middle"
              className={styles.dimLabel}
            >
              {formatDim(scenario.setback)}m
            </text>

            {/* Left setback dimension */}
            <line
              x1={toX(0)}
              y1={toY(tent.length / 2) - 20}
              x2={toX(scenario.setback)}
              y2={toY(tent.length / 2) - 20}
              stroke={COLORS.dimLine}
              strokeWidth={1}
              markerStart="url(#arrowLeft)"
              markerEnd="url(#arrowRight)"
            />
            <rect
              x={toX(scenario.setback / 2) - 30}
              y={toY(tent.length / 2) - 29}
              width={60}
              height={18}
              rx={4}
              fill={COLORS.labelBg}
              stroke={COLORS.dimLine}
              strokeWidth={0.5}
            />
            <text
              x={toX(scenario.setback / 2)}
              y={toY(tent.length / 2) - 16}
              textAnchor="middle"
              className={styles.dimLabel}
            >
              {formatDim(scenario.setback)}m
            </text>
          </g>
        )}

        {/* ── Rails ── */}
        <g
          className={styles.animFadeIn}
          style={{ animationDelay: `${ANIM.railDelay}ms` }}
        >
          {/* Left rail */}
          <rect
            x={toX(scenario.setback)}
            y={toY(scenario.setback)}
            width={toS(RAIL_THICKNESS)}
            height={toS(scenario.usableLength)}
            fill={COLORS.rail}
            rx={1}
          />
          {/* Right rail */}
          <rect
            x={toX(tent.width - scenario.setback - RAIL_THICKNESS)}
            y={toY(scenario.setback)}
            width={toS(RAIL_THICKNESS)}
            height={toS(scenario.usableLength)}
            fill={COLORS.rail}
            rx={1}
          />
        </g>

        {/* ── Columns with braces ── */}
        {scenario.columns.map((column, colIdx) => {
          const { columnType, position } = column;
          const colDelay = ANIM.columnBaseDelay + colIdx * ANIM.columnStagger;
          const isHovered = hoveredColumn === colIdx;
          const isSelected = selectedColumnIndex === colIdx;

          return (
            <g
              key={colIdx}
              className={`${styles.animSlideUp} ${styles.columnGroup} ${isSelected ? styles.columnSelected : ''}`}
              style={{ animationDelay: `${colDelay}ms`, cursor: onColumnClick ? 'pointer' : 'default' }}
              onClick={(e) => handleColumnClick(column, colIdx, e)}
              onKeyDown={(e) => handleColumnKeyDown(column, colIdx, e)}
              onMouseEnter={() => setHoveredColumn(colIdx)}
              onMouseLeave={() => setHoveredColumn(null)}
              role={onColumnClick ? 'button' : undefined}
              tabIndex={onColumnClick ? 0 : undefined}
              aria-label={`Column ${colIdx + 1}: ${columnType.braceCount} braces of ${columnType.braceLength}m x ${columnType.braceWidth}m${columnType.gap > 0.001 ? `, gap ${formatDim(columnType.gap)}m` : ''}`}
            >
              {/* Braces */}
              {Array.from({ length: columnType.braceCount }, (_, i) => {
                const bx = toX(position);
                const by = toY(scenario.setback + i * columnType.fillLength);
                const bw = toS(columnType.columnWidth);
                const bh = toS(columnType.fillLength);
                return (
                  <g key={i}>
                    <rect
                      x={bx}
                      y={by}
                      width={bw}
                      height={bh}
                      fill={isHovered || isSelected ? COLORS.braceHover : COLORS.brace}
                      stroke={COLORS.braceBorder}
                      strokeWidth={1}
                      rx={2}
                      className={styles.braceRect}
                    />
                    {/* Brace dimension label */}
                    {showBraceLabels && i === 0 && (
                      <text
                        x={bx + bw / 2}
                        y={by + bh / 2 + 4}
                        textAnchor="middle"
                        className={styles.braceDimLabel}
                      >
                        {formatDim(columnType.braceLength)}x{formatDim(columnType.braceWidth)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Gap */}
              {columnType.gap > 0.001 && (() => {
                const gx = toX(position);
                const gy = toY(
                  scenario.setback + columnType.braceCount * columnType.fillLength
                );
                const gw = toS(columnType.columnWidth);
                const gh = toS(columnType.gap);
                return (
                  <g
                    className={styles.animFadeIn}
                    style={{
                      animationDelay: `${colDelay + ANIM.gapExtraDelay}ms`,
                    }}
                  >
                    <rect
                      x={gx}
                      y={gy}
                      width={gw}
                      height={gh}
                      fill={COLORS.gap}
                      stroke={COLORS.gapBorder}
                      strokeWidth={1}
                      rx={1}
                    />
                    {/* Gap size label */}
                    {showGapLabels && (
                      <text
                        x={gx + gw / 2}
                        y={gy + gh / 2 + 3}
                        textAnchor="middle"
                        className={styles.gapDimLabel}
                      >
                        {formatDim(columnType.gap)}m
                      </text>
                    )}
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* ── Overall dimension labels ── */}
        <g
          className={styles.animFadeIn}
          style={{
            animationDelay: `${ANIM.columnBaseDelay + scenario.columns.length * ANIM.columnStagger + ANIM.labelDelay}ms`,
          }}
        >
          {/* Width label (bottom) */}
          <line
            x1={toX(0)}
            y1={toY(tent.length) + 20}
            x2={toX(tent.width)}
            y2={toY(tent.length) + 20}
            stroke={COLORS.dimLine}
            strokeWidth={1}
            markerStart="url(#arrowLeft)"
            markerEnd="url(#arrowRight)"
          />
          <rect
            x={toX(tent.width / 2) - 30}
            y={toY(tent.length) + 11}
            width={60}
            height={20}
            rx={4}
            fill={COLORS.labelBg}
            stroke={COLORS.dimLine}
            strokeWidth={0.5}
          />
          <text
            x={toX(tent.width / 2)}
            y={toY(tent.length) + 25}
            textAnchor="middle"
            className={styles.measureLabel}
          >
            {formatDim(tent.width)}m
          </text>

          {/* Length label (right) */}
          <line
            x1={toX(tent.width) + 20}
            y1={toY(0)}
            x2={toX(tent.width) + 20}
            y2={toY(tent.length)}
            stroke={COLORS.dimLine}
            strokeWidth={1}
            markerStart="url(#arrowUp)"
            markerEnd="url(#arrowDown)"
          />
          <rect
            x={toX(tent.width) + 10}
            y={toY(tent.length / 2) - 10}
            width={60}
            height={20}
            rx={4}
            fill={COLORS.labelBg}
            stroke={COLORS.dimLine}
            strokeWidth={0.5}
          />
          <text
            x={toX(tent.width) + 40}
            y={toY(tent.length / 2) + 4}
            textAnchor="middle"
            className={styles.measureLabel}
          >
            {formatDim(tent.length)}m
          </text>
        </g>

        {/* ── Arrow markers ── */}
        <defs>
          <marker id="arrowRight" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill={COLORS.dimLine} />
          </marker>
          <marker id="arrowLeft" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M8,0 L0,3 L8,6" fill={COLORS.dimLine} />
          </marker>
          <marker id="arrowDown" markerWidth="6" markerHeight="8" refX="3" refY="8" orient="auto">
            <path d="M0,0 L3,8 L6,0" fill={COLORS.dimLine} />
          </marker>
          <marker id="arrowUp" markerWidth="6" markerHeight="8" refX="3" refY="0" orient="auto">
            <path d="M0,8 L3,0 L6,8" fill={COLORS.dimLine} />
          </marker>
        </defs>
      </svg>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: COLORS.brace }} />
          <span>Braces</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: COLORS.gap, border: `1px solid ${COLORS.gapBorder}` }} />
          <span>Gaps</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: COLORS.rail }} />
          <span>Rails</span>
        </div>
      </div>

      {/* Click hint */}
      {onColumnClick && (
        <div className={styles.clickHint}>
          Click a column for details
        </div>
      )}
    </div>
  );
}
