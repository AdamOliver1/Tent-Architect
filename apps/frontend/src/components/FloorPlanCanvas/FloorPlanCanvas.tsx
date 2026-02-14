import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { Scenario, Column } from '../../types';
import { ZoomControls } from '../ZoomControls';
import styles from './FloorPlanCanvas.module.scss';

interface FloorPlanCanvasProps {
  scenario: Scenario;
  onColumnClick?: (column: Column, index: number, rect: DOMRect) => void;
  selectedColumnIndex?: number | null;
  braceColorMap?: Record<string, string>;
}

const RAIL_THICKNESS = 0.05; // 5cm

// Warm, architectural color palette
const COLORS = {
  background: '#EDEBE8',
  tentBorder: '#8A9490',
  setbackLine: '#A0877A',
  setbackFill: 'rgba(196, 149, 106, 0.15)',
  setbackStripe: 'rgba(196, 149, 106, 0.08)',
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

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function FloorPlanCanvas({
  scenario,
  onColumnClick,
  selectedColumnIndex,
  braceColorMap = {},
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

  // Asymmetric setbacks
  const setbackLeft = scenario.setback; // rail-end
  const setbackRight = scenario.setback; // rail-end
  const setbackTop = scenario.openEndSetbackStart; // open-end start
  const setbackBottom = scenario.openEndSetbackEnd; // open-end end

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

  // Layout calculation - use scenario's actual dimensions
  const layout = useMemo(() => {
    const padding = 80;
    const svgWidth = containerWidth;
    const svgHeight = Math.max(500, containerHeight);
    const availableWidth = svgWidth - 2 * padding;
    const availableHeight = svgHeight - 2 * padding;
    const scaleX = availableWidth / scenario.tentWidth;
    const scaleY = availableHeight / scenario.tentLength;
    const scale = Math.min(scaleX, scaleY);

    const tentDisplayWidth = scenario.tentWidth * scale;
    const tentDisplayHeight = scenario.tentLength * scale;
    const offsetX = (svgWidth - tentDisplayWidth) / 2;
    const offsetY = (svgHeight - tentDisplayHeight) / 2;

    return { padding, svgWidth, svgHeight, scale, offsetX, offsetY, tentDisplayWidth, tentDisplayHeight };
  }, [containerWidth, containerHeight, scenario.tentWidth, scenario.tentLength]);

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

  // Get brace color for a column
  const getBraceColor = useCallback(
    (col: Column) => {
      const key = `${col.columnType.braceLength}×${col.columnType.braceWidth}`;
      return braceColorMap[key] || COLORS.brace;
    },
    [braceColorMap]
  );

  // Helper function to calculate brace label properties
  const getBraceLabelProps = useCallback((columnType: any) => {
    const pixelW = toS(columnType.columnWidth) * zoom;
    const pixelH = toS(columnType.fillLength) * zoom;

    // Always show labels, but adjust positioning and size
    const labelText = `${formatDim(columnType.braceLength)}×${formatDim(columnType.braceWidth)}`;
    const estimatedTextWidth = labelText.length * 5.5;

    // Determine if label fits inside
    const fitsInside = pixelW >= (estimatedTextWidth + 8) && pixelH >= 16;

    // Dynamic font size
    let fontSize = 9;
    if (pixelH < 25 || pixelW < 50) {
      fontSize = 8;
    } else if (pixelH > 40 && pixelW > 80) {
      fontSize = 10;
    }

    // Very small braces get tiny font
    if (pixelH < 15 || pixelW < 30) {
      fontSize = 7;
    }

    return {
      show: true,
      fontSize,
      fitsInside,
      outside: !fitsInside
    };
  }, [toS, zoom]);

  const showGapLabels = useMemo(() => {
    return scenario.columns.some((col) => {
      if (col.columnType.gap <= 0.001) return false;
      const pixelH = toS(col.columnType.gap) * zoom;
      return pixelH > 14;
    });
  }, [scenario.columns, toS, zoom]);

  // Build legend entries from distinct brace types in scenario
  const legendEntries = useMemo(() => {
    const seen = new Map<string, { length: number; width: number; color: string }>();
    for (const col of scenario.columns) {
      const ct = col.columnType;
      const key = `${ct.braceLength}×${ct.braceWidth}`;
      if (!seen.has(key)) {
        seen.set(key, {
          length: ct.braceLength,
          width: ct.braceWidth,
          color: braceColorMap[key] || COLORS.brace,
        });
      }
    }
    return Array.from(seen.values());
  }, [scenario.columns, braceColorMap]);

  // Mini-map dimensions
  const miniMapWidth = 140;
  const miniMapHeight = Math.round(miniMapWidth * (scenario.tentLength / scenario.tentWidth));
  const miniMapScale = (miniMapWidth - 16) / scenario.tentWidth;
  const miniMapPadding = 8;

  // Viewport indicator on mini-map
  const viewportX = miniMapPadding - (panOffset.x / layout.scale / zoom) * miniMapScale;
  const viewportY = miniMapPadding - (panOffset.y / layout.scale / zoom) * miniMapScale;
  const viewportW = (layout.svgWidth / layout.scale / zoom) * miniMapScale;
  const viewportH = (layout.svgHeight / layout.scale / zoom) * miniMapScale;

  // Helper: render a setback dimension line OUTSIDE the tent boundary with label
  // Lines are drawn from tent edge to setback boundary, but offset into the margin
  // so braces/rails never cover them.
  const renderSetbackDim = (
    side: 'top' | 'bottom' | 'left' | 'right',
    value: number,
    delay: number
  ) => {
    if (value <= 0.001) return null;

    const LABEL_W = 72;
    const LABEL_H = 24;
    const LINE_COLOR = '#A0877A';
    const LABEL_BG = '#FFF8F0';
    const LABEL_BORDER = '#C4956A';
    const OUTSIDE_OFFSET = 14; // px outside the tent edge

    if (side === 'top') {
      // Vertical line outside left edge of tent, spanning from top of tent to setback
      const lineX = toX(0) - OUTSIDE_OFFSET;
      const y1 = toY(0);
      const y2 = toY(value);
      const midY = (y1 + y2) / 2;
      return (
        <g key={side} className={styles.animFadeIn} style={{ animationDelay: `${delay}ms` }}>
          {/* Tick marks connecting to tent edge */}
          <line x1={lineX} y1={y1} x2={toX(0)} y2={y1} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={lineX} y1={y2} x2={toX(0)} y2={y2} stroke={LINE_COLOR} strokeWidth={1} />
          {/* Vertical dimension line */}
          <line x1={lineX} y1={y1 + 4} x2={lineX} y2={y2 - 4}
            stroke={LINE_COLOR} strokeWidth={2}
            markerStart="url(#arrowUp)" markerEnd="url(#arrowDown)" />
          {/* Label */}
          <rect x={lineX - LABEL_W - 4} y={midY - LABEL_H / 2} width={LABEL_W} height={LABEL_H} rx={6}
            fill={LABEL_BG} stroke={LABEL_BORDER} strokeWidth={1} />
          <text x={lineX - LABEL_W / 2 - 4} y={midY + 5} textAnchor="middle" className={styles.setbackLabel}>
            {formatDim(value)}m
          </text>
        </g>
      );
    }

    if (side === 'bottom') {
      // Vertical line outside right edge of tent
      const lineX = toX(scenario.tentWidth) + OUTSIDE_OFFSET;
      const y1 = toY(scenario.tentLength - value);
      const y2 = toY(scenario.tentLength);
      const midY = (y1 + y2) / 2;
      return (
        <g key={side} className={styles.animFadeIn} style={{ animationDelay: `${delay}ms` }}>
          <line x1={toX(scenario.tentWidth)} y1={y1} x2={lineX} y2={y1} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={toX(scenario.tentWidth)} y1={y2} x2={lineX} y2={y2} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={lineX} y1={y1 + 4} x2={lineX} y2={y2 - 4}
            stroke={LINE_COLOR} strokeWidth={2}
            markerStart="url(#arrowUp)" markerEnd="url(#arrowDown)" />
          <rect x={lineX + 4} y={midY - LABEL_H / 2} width={LABEL_W} height={LABEL_H} rx={6}
            fill={LABEL_BG} stroke={LABEL_BORDER} strokeWidth={1} />
          <text x={lineX + LABEL_W / 2 + 4} y={midY + 5} textAnchor="middle" className={styles.setbackLabel}>
            {formatDim(value)}m
          </text>
        </g>
      );
    }

    if (side === 'left') {
      // Horizontal line above the tent
      const lineY = toY(0) - OUTSIDE_OFFSET;
      const x1 = toX(0);
      const x2 = toX(value);
      const midX = (x1 + x2) / 2;
      return (
        <g key={side} className={styles.animFadeIn} style={{ animationDelay: `${delay}ms` }}>
          <line x1={x1} y1={toY(0)} x2={x1} y2={lineY} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={x2} y1={toY(0)} x2={x2} y2={lineY} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={x1 + 4} y1={lineY} x2={x2 - 4} y2={lineY}
            stroke={LINE_COLOR} strokeWidth={2}
            markerStart="url(#arrowLeft)" markerEnd="url(#arrowRight)" />
          <rect x={midX - LABEL_W / 2} y={lineY - LABEL_H - 4} width={LABEL_W} height={LABEL_H} rx={6}
            fill={LABEL_BG} stroke={LABEL_BORDER} strokeWidth={1} />
          <text x={midX} y={lineY - LABEL_H / 2 + 2} textAnchor="middle" className={styles.setbackLabel}>
            {formatDim(value)}m
          </text>
        </g>
      );
    }

    if (side === 'right') {
      // Horizontal line below the tent
      const lineY = toY(scenario.tentLength) + OUTSIDE_OFFSET;
      const x1 = toX(scenario.tentWidth - value);
      const x2 = toX(scenario.tentWidth);
      const midX = (x1 + x2) / 2;
      return (
        <g key={side} className={styles.animFadeIn} style={{ animationDelay: `${delay}ms` }}>
          <line x1={x1} y1={toY(scenario.tentLength)} x2={x1} y2={lineY} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={x2} y1={toY(scenario.tentLength)} x2={x2} y2={lineY} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={x1 + 4} y1={lineY} x2={x2 - 4} y2={lineY}
            stroke={LINE_COLOR} strokeWidth={2}
            markerStart="url(#arrowLeft)" markerEnd="url(#arrowRight)" />
          <rect x={midX - LABEL_W / 2} y={lineY + 4} width={LABEL_W} height={LABEL_H} rx={6}
            fill={LABEL_BG} stroke={LABEL_BORDER} strokeWidth={1} />
          <text x={midX} y={lineY + LABEL_H / 2 + 10} textAnchor="middle" className={styles.setbackLabel}>
            {formatDim(value)}m
          </text>
        </g>
      );
    }

    return null;
  };

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
        aria-label={`Floor plan for ${scenario.tentLength}m by ${scenario.tentWidth}m tent, ${scenario.name}`}
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
          width={toS(scenario.tentWidth)}
          height={toS(scenario.tentLength)}
          fill="rgba(255,255,255,0.3)"
          stroke={COLORS.tentBorder}
          strokeWidth={2}
          rx={3}
          className={styles.animFadeIn}
          style={{ animationDelay: `${ANIM.tentDelay}ms` }}
        />

        {/* ── Setback hatching pattern ── */}
        <defs>
          <pattern id="setbackHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke={COLORS.setbackLine} strokeWidth="1" opacity="0.35" />
          </pattern>
        </defs>

        {/* ── Setback strips (4 sides, individually visible) ── */}
        <g className={styles.animFadeIn} style={{ animationDelay: `${ANIM.setbackDelay}ms` }}>
          {/* Top strip (open-end start) */}
          {setbackTop > 0.001 && (
            <g>
              <rect x={toX(0)} y={toY(0)} width={toS(scenario.tentWidth)} height={toS(setbackTop)}
                fill={COLORS.setbackFill} />
              <rect x={toX(0)} y={toY(0)} width={toS(scenario.tentWidth)} height={toS(setbackTop)}
                fill="url(#setbackHatch)" />
            </g>
          )}
          {/* Bottom strip (open-end end) */}
          {setbackBottom > 0.001 && (
            <g>
              <rect x={toX(0)} y={toY(scenario.tentLength - setbackBottom)}
                width={toS(scenario.tentWidth)} height={toS(setbackBottom)}
                fill={COLORS.setbackFill} />
              <rect x={toX(0)} y={toY(scenario.tentLength - setbackBottom)}
                width={toS(scenario.tentWidth)} height={toS(setbackBottom)}
                fill="url(#setbackHatch)" />
            </g>
          )}
          {/* Left strip (rail-end) */}
          {setbackLeft > 0.001 && (
            <g>
              <rect x={toX(0)} y={toY(setbackTop)}
                width={toS(setbackLeft)} height={toS(scenario.tentLength - setbackTop - setbackBottom)}
                fill={COLORS.setbackFill} />
              <rect x={toX(0)} y={toY(setbackTop)}
                width={toS(setbackLeft)} height={toS(scenario.tentLength - setbackTop - setbackBottom)}
                fill="url(#setbackHatch)" />
            </g>
          )}
          {/* Right strip (rail-end) */}
          {setbackRight > 0.001 && (
            <g>
              <rect x={toX(scenario.tentWidth - setbackRight)} y={toY(setbackTop)}
                width={toS(setbackRight)} height={toS(scenario.tentLength - setbackTop - setbackBottom)}
                fill={COLORS.setbackFill} />
              <rect x={toX(scenario.tentWidth - setbackRight)} y={toY(setbackTop)}
                width={toS(setbackRight)} height={toS(scenario.tentLength - setbackTop - setbackBottom)}
                fill="url(#setbackHatch)" />
            </g>
          )}

          {/* Inner usable border */}
          <rect
            x={toX(setbackLeft)} y={toY(setbackTop)}
            width={toS(scenario.tentWidth - setbackLeft - setbackRight)}
            height={toS(scenario.tentLength - setbackTop - setbackBottom)}
            fill="none" stroke={COLORS.setbackLine} strokeWidth={1.5} strokeDasharray="6 3" rx={2}
          />
        </g>

        {/* ── Rails ── */}
        <g
          className={styles.animFadeIn}
          style={{ animationDelay: `${ANIM.railDelay}ms` }}
        >
          <rect
            x={toX(setbackLeft)}
            y={toY(setbackTop)}
            width={toS(RAIL_THICKNESS)}
            height={toS(scenario.tentLength - setbackTop - setbackBottom)}
            fill={COLORS.rail}
            rx={1}
          />
          <rect
            x={toX(scenario.tentWidth - setbackRight - RAIL_THICKNESS)}
            y={toY(setbackTop)}
            width={toS(RAIL_THICKNESS)}
            height={toS(scenario.tentLength - setbackTop - setbackBottom)}
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
          const braceColor = getBraceColor(column);
          const braceHoverColor = lightenColor(braceColor, 16);
          const braceBorderColor = darkenColor(braceColor, 16);
          const labelProps = getBraceLabelProps(columnType);

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
                const by = toY(setbackTop + i * columnType.fillLength);
                const bw = toS(columnType.columnWidth);
                const bh = toS(columnType.fillLength);
                return (
                  <g key={i}>
                    <rect
                      x={bx}
                      y={by}
                      width={bw}
                      height={bh}
                      fill={isHovered || isSelected ? braceHoverColor : braceColor}
                      stroke={braceBorderColor}
                      strokeWidth={1}
                      rx={3}
                      className={styles.braceRect}
                    />
                    {i === 0 && labelProps.show && (
                      labelProps.outside ? (
                        // Label above brace when it doesn't fit inside
                        <text
                          x={bx + bw / 2}
                          y={by - 4}
                          textAnchor="middle"
                          className={styles.braceDimLabelOutside}
                          style={{ fontSize: `${labelProps.fontSize}px` }}
                        >
                          {formatDim(columnType.braceLength)}×{formatDim(columnType.braceWidth)}
                        </text>
                      ) : (
                        // Label inside brace
                        <text
                          x={bx + bw / 2}
                          y={by + bh / 2 + 4}
                          textAnchor="middle"
                          className={styles.braceDimLabel}
                          style={{ fontSize: `${labelProps.fontSize}px` }}
                        >
                          {formatDim(columnType.braceLength)}×{formatDim(columnType.braceWidth)}
                        </text>
                      )
                    )}
                  </g>
                );
              })}

              {/* Gap */}
              {columnType.gap > 0.001 && (() => {
                const gx = toX(position);
                const gy = toY(
                  setbackTop + columnType.braceCount * columnType.fillLength
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

        {/* ── Setback dimension lines (rendered on top of columns) ── */}
        {renderSetbackDim('top', setbackTop, ANIM.setbackDelay + 100)}
        {renderSetbackDim('bottom', setbackBottom, ANIM.setbackDelay + 100)}
        {renderSetbackDim('left', setbackLeft, ANIM.setbackDelay + 100)}
        {renderSetbackDim('right', setbackRight, ANIM.setbackDelay + 100)}

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
            y1={toY(scenario.tentLength) + 24}
            x2={toX(scenario.tentWidth)}
            y2={toY(scenario.tentLength) + 24}
            stroke={COLORS.dimLine}
            strokeWidth={1}
            markerStart="url(#arrowLeft)"
            markerEnd="url(#arrowRight)"
          />
          <rect
            x={toX(scenario.tentWidth / 2) - 30}
            y={toY(scenario.tentLength) + 15}
            width={60}
            height={20}
            rx={6}
            fill={COLORS.labelBg}
            stroke={COLORS.dimLine}
            strokeWidth={0.5}
          />
          <text
            x={toX(scenario.tentWidth / 2)}
            y={toY(scenario.tentLength) + 29}
            textAnchor="middle"
            className={styles.measureLabel}
          >
            {formatDim(scenario.tentWidth)}m
          </text>

          {/* Length (right) */}
          <line
            x1={toX(scenario.tentWidth) + 24}
            y1={toY(0)}
            x2={toX(scenario.tentWidth) + 24}
            y2={toY(scenario.tentLength)}
            stroke={COLORS.dimLine}
            strokeWidth={1}
            markerStart="url(#arrowUp)"
            markerEnd="url(#arrowDown)"
          />
          <rect
            x={toX(scenario.tentWidth) + 14}
            y={toY(scenario.tentLength / 2) - 10}
            width={60}
            height={20}
            rx={6}
            fill={COLORS.labelBg}
            stroke={COLORS.dimLine}
            strokeWidth={0.5}
          />
          <text
            x={toX(scenario.tentWidth) + 44}
            y={toY(scenario.tentLength / 2) + 4}
            textAnchor="middle"
            className={styles.measureLabel}
          >
            {formatDim(scenario.tentLength)}m
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

      {/* ── Legend (bottom-left, floating) — brace types with colors ── */}
      <div className={styles.legend}>
        {legendEntries.map((entry) => (
          <div key={`${entry.length}×${entry.width}`} className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ backgroundColor: entry.color }} />
            <span>{formatDim(entry.length)}×{formatDim(entry.width)}m</span>
          </div>
        ))}
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
              width={scenario.tentWidth * miniMapScale}
              height={scenario.tentLength * miniMapScale}
              fill="none"
              stroke={COLORS.tentBorder}
              strokeWidth={1}
              rx={1}
            />
            {/* Columns */}
            {scenario.columns.map((col, i) => {
              const colColor = braceColorMap[`${col.columnType.braceLength}×${col.columnType.braceWidth}`] || COLORS.brace;
              return (
                <rect
                  key={i}
                  x={miniMapPadding + col.position * miniMapScale}
                  y={miniMapPadding + setbackTop * miniMapScale}
                  width={col.columnType.columnWidth * miniMapScale}
                  height={(scenario.tentLength - setbackTop - setbackBottom) * miniMapScale}
                  fill={colColor}
                  opacity={0.5}
                  rx={0.5}
                />
              );
            })}
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
