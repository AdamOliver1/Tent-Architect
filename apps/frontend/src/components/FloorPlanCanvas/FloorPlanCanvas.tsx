import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { Scenario, Column, TentDimensions } from '../../types';
import { ZoomControls } from '../ZoomControls';
import styles from './FloorPlanCanvas.module.scss';

interface FloorPlanCanvasProps {
  scenario: Scenario;
  tent: TentDimensions;
  onColumnClick?: (column: Column, index: number, rect: DOMRect) => void;
  selectedColumnIndex?: number | null;
}

const RAIL_THICKNESS = 0.05; // 5cm

// Warm, architectural color palette
const COLORS = {
  background: '#EDEBE8',
  tentBorder: '#8A9490',
  setbackLine: '#B5B0A8',
  setbackFill: 'rgba(90, 122, 108, 0.04)',
  rail: '#4A5553',
  brace: '#5A7A6C',
  braceHover: '#4A6A5C',
  braceBorder: '#3A5A4C',
  gap: '#FFF0DB',
  gapBorder: '#C4956A',
  text: '#5A6462',
  dimLine: '#8A9490',
  labelBg: 'rgba(253,252,250,0.94)',
  miniMapBg: 'rgba(253,252,250,0.9)',
  miniMapViewport: 'rgba(90, 122, 108, 0.25)',
  miniMapViewportBorder: '#5A7A6C',
};

const ANIM = {
  tentDelay: 0,
  setbackDelay: 200,
  railDelay: 400,
  columnBaseDelay: 600,
  columnStagger: 100,
  gapExtraDelay: 80,
  labelDelay: 200,
  duration: 400,
};

function formatDim(n: number): string {
  if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, '');
  return n.toFixed(3).replace(/\.?0+$/, '');
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function FloorPlanCanvas({
  scenario,
  tent,
  onColumnClick,
  selectedColumnIndex,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(600);
  const [animKey, setAnimKey] = useState(0);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });

  // Trigger re-animation when scenario changes
  useEffect(() => {
    setAnimKey((k) => k + 1);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [scenario]);

  // Responsive sizing — use full available space
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      setContainerWidth(el.clientWidth);
      setContainerHeight(el.clientHeight);
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Layout calculation
  const layout = useMemo(() => {
    const padding = 80;
    const svgWidth = containerWidth;
    const svgHeight = Math.max(500, containerHeight);
    const availableWidth = svgWidth - 2 * padding;
    const availableHeight = svgHeight - 2 * padding;
    const scaleX = availableWidth / tent.width;
    const scaleY = availableHeight / tent.length;
    const scale = Math.min(scaleX, scaleY);

    const tentDisplayWidth = tent.width * scale;
    const tentDisplayHeight = tent.length * scale;
    const offsetX = (svgWidth - tentDisplayWidth) / 2;
    const offsetY = (svgHeight - tentDisplayHeight) / 2;

    return { padding, svgWidth, svgHeight, scale, offsetX, offsetY, tentDisplayWidth, tentDisplayHeight };
  }, [containerWidth, containerHeight, tent]);

  const toX = useCallback((x: number) => layout.offsetX + x * layout.scale, [layout]);
  const toY = useCallback((y: number) => layout.offsetY + y * layout.scale, [layout]);
  const toS = useCallback((s: number) => s * layout.scale, [layout]);

  // ── Zoom handlers ──
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleFitToView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Pan handlers
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    // Only pan with middle button or when holding space
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffsetStart.current = { ...panOffset };
    }
  }, [panOffset]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPanOffset({
      x: panOffsetStart.current.x + dx,
      y: panOffsetStart.current.y + dy,
    });
  }, [isPanning]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

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

  // Brace label visibility
  const showBraceLabels = useMemo(() => {
    if (scenario.columns.length === 0) return false;
    const firstCol = scenario.columns[0].columnType;
    const pixelW = toS(firstCol.columnWidth) * zoom;
    const pixelH = toS(firstCol.fillLength) * zoom;
    return pixelW > 40 && pixelH > 18;
  }, [scenario.columns, toS, zoom]);

  const showGapLabels = useMemo(() => {
    return scenario.columns.some((col) => {
      if (col.columnType.gap <= 0.001) return false;
      const pixelH = toS(col.columnType.gap) * zoom;
      return pixelH > 14;
    });
  }, [scenario.columns, toS, zoom]);

  // Mini-map dimensions
  const miniMapWidth = 140;
  const miniMapHeight = Math.round(miniMapWidth * (tent.length / tent.width));
  const miniMapScale = (miniMapWidth - 16) / tent.width;
  const miniMapPadding = 8;

  // Viewport indicator on mini-map
  const viewportX = miniMapPadding - (panOffset.x / layout.scale / zoom) * miniMapScale;
  const viewportY = miniMapPadding - (panOffset.y / layout.scale / zoom) * miniMapScale;
  const viewportW = (layout.svgWidth / layout.scale / zoom) * miniMapScale;
  const viewportH = (layout.svgHeight / layout.scale / zoom) * miniMapScale;

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isPanning ? styles.panning : ''}`}
      onMouseDown={handlePanStart}
      onMouseMove={handlePanMove}
      onMouseUp={handlePanEnd}
      onMouseLeave={handlePanEnd}
    >
      {/* ── Canvas background pattern ── */}
      <div className={styles.canvasBg} aria-hidden="true" />

      {/* ── Main SVG ── */}
      <svg
        ref={svgRef}
        key={animKey}
        width={layout.svgWidth}
        height={layout.svgHeight}
        viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
        className={styles.svg}
        style={{
          transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
          transformOrigin: 'center center',
        }}
        role="img"
        aria-label={`Floor plan for ${tent.length}m by ${tent.width}m tent, ${scenario.name}`}
      >
        {/* Background */}
        <rect width={layout.svgWidth} height={layout.svgHeight} fill={COLORS.background} />

        {/* Subtle grid pattern */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={layout.svgWidth} height={layout.svgHeight} fill="url(#grid)" />

        {/* ── Tent Outline ── */}
        <rect
          x={toX(0)}
          y={toY(0)}
          width={toS(tent.width)}
          height={toS(tent.length)}
          fill="rgba(255,255,255,0.3)"
          stroke={COLORS.tentBorder}
          strokeWidth={2}
          rx={3}
          className={styles.animFadeIn}
          style={{ animationDelay: `${ANIM.tentDelay}ms` }}
        />

        {/* ── Setback area ── */}
        <rect
          x={toX(scenario.setback)}
          y={toY(scenario.setback)}
          width={toS(tent.width - 2 * scenario.setback)}
          height={toS(tent.length - 2 * scenario.setback)}
          fill={COLORS.setbackFill}
          stroke={COLORS.setbackLine}
          strokeWidth={1}
          strokeDasharray="8 4"
          rx={2}
          className={styles.animFadeIn}
          style={{ animationDelay: `${ANIM.setbackDelay}ms` }}
        />

        {/* ── Setback dimension lines ── */}
        {scenario.setback > 0.15 && (
          <g
            className={styles.animFadeIn}
            style={{ animationDelay: `${ANIM.setbackDelay + 100}ms` }}
          >
            {/* Top setback */}
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
              rx={6}
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

            {/* Left setback */}
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
              rx={6}
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
          <rect
            x={toX(scenario.setback)}
            y={toY(scenario.setback)}
            width={toS(RAIL_THICKNESS)}
            height={toS(scenario.usableLength)}
            fill={COLORS.rail}
            rx={1}
          />
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
                      rx={3}
                      className={styles.braceRect}
                    />
                    {showBraceLabels && i === 0 && (
                      <text
                        x={bx + bw / 2}
                        y={by + bh / 2 + 4}
                        textAnchor="middle"
                        className={styles.braceDimLabel}
                      >
                        {formatDim(columnType.braceLength)}×{formatDim(columnType.braceWidth)}
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
                    style={{ animationDelay: `${colDelay + ANIM.gapExtraDelay}ms` }}
                  >
                    <rect
                      x={gx}
                      y={gy}
                      width={gw}
                      height={gh}
                      fill={COLORS.gap}
                      stroke={COLORS.gapBorder}
                      strokeWidth={1}
                      rx={2}
                    />
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
          {/* Width (bottom) */}
          <line
            x1={toX(0)}
            y1={toY(tent.length) + 24}
            x2={toX(tent.width)}
            y2={toY(tent.length) + 24}
            stroke={COLORS.dimLine}
            strokeWidth={1}
            markerStart="url(#arrowLeft)"
            markerEnd="url(#arrowRight)"
          />
          <rect
            x={toX(tent.width / 2) - 30}
            y={toY(tent.length) + 15}
            width={60}
            height={20}
            rx={6}
            fill={COLORS.labelBg}
            stroke={COLORS.dimLine}
            strokeWidth={0.5}
          />
          <text
            x={toX(tent.width / 2)}
            y={toY(tent.length) + 29}
            textAnchor="middle"
            className={styles.measureLabel}
          >
            {formatDim(tent.width)}m
          </text>

          {/* Length (right) */}
          <line
            x1={toX(tent.width) + 24}
            y1={toY(0)}
            x2={toX(tent.width) + 24}
            y2={toY(tent.length)}
            stroke={COLORS.dimLine}
            strokeWidth={1}
            markerStart="url(#arrowUp)"
            markerEnd="url(#arrowDown)"
          />
          <rect
            x={toX(tent.width) + 14}
            y={toY(tent.length / 2) - 10}
            width={60}
            height={20}
            rx={6}
            fill={COLORS.labelBg}
            stroke={COLORS.dimLine}
            strokeWidth={0.5}
          />
          <text
            x={toX(tent.width) + 44}
            y={toY(tent.length / 2) + 4}
            textAnchor="middle"
            className={styles.measureLabel}
          >
            {formatDim(tent.length)}m
          </text>
        </g>

        {/* Arrow markers */}
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

      {/* ── Legend (bottom-left, floating) ── */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ backgroundColor: COLORS.brace }} />
          <span>Braces</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ backgroundColor: COLORS.gap, border: `1px solid ${COLORS.gapBorder}` }} />
          <span>Gaps</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ backgroundColor: COLORS.rail }} />
          <span>Rails</span>
        </div>
      </div>

      {/* ── Zoom controls (bottom-center, floating) ── */}
      <div className={styles.zoomBar}>
        <ZoomControls
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitToView={handleFitToView}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        />
      </div>

      {/* ── Mini-map (bottom-right, floating) ── */}
      {zoom > 1 && (
        <div className={styles.miniMap}>
          <svg
            width={miniMapWidth}
            height={Math.min(miniMapHeight, 120)}
            viewBox={`0 0 ${miniMapWidth} ${Math.min(miniMapHeight, 120)}`}
          >
            <rect width={miniMapWidth} height={Math.min(miniMapHeight, 120)} rx={6} fill={COLORS.miniMapBg} />
            {/* Tent outline */}
            <rect
              x={miniMapPadding}
              y={miniMapPadding}
              width={tent.width * miniMapScale}
              height={tent.length * miniMapScale}
              fill="none"
              stroke={COLORS.tentBorder}
              strokeWidth={1}
              rx={1}
            />
            {/* Columns */}
            {scenario.columns.map((col, i) => (
              <rect
                key={i}
                x={miniMapPadding + col.position * miniMapScale}
                y={miniMapPadding + scenario.setback * miniMapScale}
                width={col.columnType.columnWidth * miniMapScale}
                height={scenario.usableLength * miniMapScale}
                fill={COLORS.brace}
                opacity={0.5}
                rx={0.5}
              />
            ))}
            {/* Viewport rectangle */}
            <rect
              x={Math.max(0, viewportX)}
              y={Math.max(0, viewportY)}
              width={Math.min(viewportW, miniMapWidth)}
              height={Math.min(viewportH, Math.min(miniMapHeight, 120))}
              fill={COLORS.miniMapViewport}
              stroke={COLORS.miniMapViewportBorder}
              strokeWidth={1.5}
              rx={2}
            />
          </svg>
        </div>
      )}

      {/* ── Pan hint ── */}
      {onColumnClick && zoom === 1 && (
        <div className={styles.hint}>
          Click a column for details · Ctrl+Scroll to zoom
        </div>
      )}
    </div>
  );
}
