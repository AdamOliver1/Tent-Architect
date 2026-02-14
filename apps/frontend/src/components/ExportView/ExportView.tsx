import { useMemo } from 'react';
import type { Scenario } from '../../types';
import styles from './ExportView.module.scss';

interface ExportViewProps {
  scenario: Scenario;
  tentDimensions: { length: number; width: number };
  braceColorMap: Record<string, string>;
}

const RAIL_THICKNESS = 0.05; // 5cm

// Export-optimized color palette
const COLORS = {
  background: '#FFFFFF',
  tentBorder: '#8A9490',
  setbackLine: '#A0877A',
  setbackFill: 'rgba(196, 149, 106, 0.15)',
  setbackStripe: 'rgba(196, 149, 106, 0.08)',
  rail: '#4A5553',
  brace: '#5A7A6C',
  braceBorder: '#3A5A4C',
  gap: '#FFF0DB',
  gapBorder: '#C4956A',
  text: '#5A6462',
  dimLine: '#8A9490',
  labelBg: 'rgba(253,252,250,0.94)',
};

function formatDim(n: number): string {
  if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, '');
  return n.toFixed(3).replace(/\.?0+$/, '');
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function ExportView({ scenario, tentDimensions: _tentDimensions, braceColorMap }: ExportViewProps) {
  void _tentDimensions; // Props kept for interface compatibility; using scenario dimensions instead
  // Use scenario dimensions (which match the animation) instead of user-input dimensions
  // The backend may swap width/length; scenario.tentWidth and scenario.tentLength
  // reflect the actual orientation used in the animation
  const displayWidth = scenario.tentWidth;
  const displayLength = scenario.tentLength;

  // Asymmetric setbacks
  const setbackLeft = scenario.setback; // rail-end
  const setbackRight = scenario.setback; // rail-end
  const setbackTop = scenario.openEndSetbackStart; // open-end start
  const setbackBottom = scenario.openEndSetbackEnd; // open-end end

  // Adaptive dimensions to match animation orientation exactly
  // Extra margin for dimension labels + setback labels that extend beyond the tent boundary
  const LABEL_MARGIN = 120; // Space for dimension lines, setback labels, arrows
  const padding = 80;

  // Calculate tent display size first, then determine SVG size to fit everything
  const targetTentWidth = 1000; // Target tent width in pixels (leaving room for labels)
  const baseScale = targetTentWidth / displayWidth;
  const scale = Math.min(baseScale, 150); // Cap scale like the animation

  const tentDisplayWidth = displayWidth * scale;
  const tentDisplayHeight = displayLength * scale;

  // SVG dimensions: tent + padding on all sides + extra margin for labels
  const SVG_WIDTH = tentDisplayWidth + padding * 2 + LABEL_MARGIN; // Extra right for length dim + setback labels
  const SVG_HEIGHT = tentDisplayHeight + padding * 2 + LABEL_MARGIN; // Extra bottom for width dim + setback labels

  const offsetX = padding + LABEL_MARGIN / 2; // Center with label room on left
  const offsetY = padding + LABEL_MARGIN / 2; // Top padding with label room

  const toX = (x: number) => offsetX + x * scale;
  const toY = (y: number) => offsetY + y * scale;
  const toS = (s: number) => s * scale;

  // Helper to determine label positioning and sizing
  const getBraceLabelProps = (columnType: any) => {
    const pixelW = toS(columnType.columnWidth);
    const pixelH = toS(columnType.fillLength);

    // Always show labels
    const labelText = `${formatDim(columnType.braceLength)}×${formatDim(columnType.braceWidth)}`;
    const estimatedTextWidth = labelText.length * 6;

    // Determine if label fits inside
    const fitsInside = pixelW >= (estimatedTextWidth + 10) && pixelH >= 18;

    // Dynamic font sizing
    let fontSize = 10;
    if (pixelH < 30 || pixelW < 60) {
      fontSize = 9;
    } else if (pixelH > 50 && pixelW > 100) {
      fontSize = 11;
    }

    // Very small braces
    if (pixelH < 18 || pixelW < 35) {
      fontSize = 8;
    }

    return {
      show: true,
      fontSize,
      fitsInside,
      outside: !fitsInside
    };
  };

  // Aggregate brace usage from scenario columns (handles mixed columns)
  const braceUsage = useMemo(() => {
    const usage = new Map<string, { length: number; width: number; count: number; color: string }>();
    for (const col of scenario.columns) {
      const ct = col.columnType;
      if (ct.bracePlacements) {
        for (const bp of ct.bracePlacements) {
          const key = `${bp.braceLength}×${bp.braceWidth}`;
          const existing = usage.get(key);
          if (existing) {
            existing.count += bp.count;
          } else {
            const color = braceColorMap[key] || COLORS.brace;
            usage.set(key, { length: bp.braceLength, width: bp.braceWidth, count: bp.count, color });
          }
        }
      } else {
        const key = `${ct.braceLength}×${ct.braceWidth}`;
        const existing = usage.get(key);
        if (existing) {
          existing.count += ct.braceCount;
        } else {
          const color = braceColorMap[key] || COLORS.brace;
          usage.set(key, { length: ct.braceLength, width: ct.braceWidth, count: ct.braceCount, color });
        }
      }
    }
    return Array.from(usage.values());
  }, [scenario.columns, braceColorMap]);

  // Helper: render a setback dimension line
  const renderSetbackDim = (
    side: 'top' | 'bottom' | 'left' | 'right',
    value: number
  ) => {
    if (value <= 0.001) return null;

    const LABEL_W = 72;
    const LABEL_H = 24;
    const LINE_COLOR = '#A0877A';
    const LABEL_BG = '#FFF8F0';
    const LABEL_BORDER = '#C4956A';
    const OUTSIDE_OFFSET = 14;

    if (side === 'top') {
      const lineX = toX(0) - OUTSIDE_OFFSET;
      const y1 = toY(0);
      const y2 = toY(value);
      const midY = (y1 + y2) / 2;
      return (
        <g key={side}>
          <line x1={lineX} y1={y1} x2={toX(0)} y2={y1} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={lineX} y1={y2} x2={toX(0)} y2={y2} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={lineX} y1={y1 + 4} x2={lineX} y2={y2 - 4}
            stroke={LINE_COLOR} strokeWidth={2}
            markerStart="url(#arrowUp)" markerEnd="url(#arrowDown)" />
          <rect x={lineX - LABEL_W - 4} y={midY - LABEL_H / 2} width={LABEL_W} height={LABEL_H} rx={6}
            fill={LABEL_BG} stroke={LABEL_BORDER} strokeWidth={1} />
          <text x={lineX - LABEL_W / 2 - 4} y={midY + 5} textAnchor="middle" className={styles.setbackLabel}>
            {formatDim(value)}m
          </text>
        </g>
      );
    }

    if (side === 'bottom') {
      const lineX = toX(displayWidth) + OUTSIDE_OFFSET;
      const y1 = toY(displayLength - value);
      const y2 = toY(displayLength);
      const midY = (y1 + y2) / 2;
      return (
        <g key={side}>
          <line x1={toX(displayWidth)} y1={y1} x2={lineX} y2={y1} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={toX(displayWidth)} y1={y2} x2={lineX} y2={y2} stroke={LINE_COLOR} strokeWidth={1} />
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
      const lineY = toY(0) - OUTSIDE_OFFSET;
      const x1 = toX(0);
      const x2 = toX(value);
      const midX = (x1 + x2) / 2;
      return (
        <g key={side}>
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
      const lineY = toY(displayLength) + OUTSIDE_OFFSET;
      const x1 = toX(displayWidth - value);
      const x2 = toX(displayWidth);
      const midX = (x1 + x2) / 2;
      return (
        <g key={side}>
          <line x1={x1} y1={toY(displayLength)} x2={x1} y2={lineY} stroke={LINE_COLOR} strokeWidth={1} />
          <line x1={x2} y1={toY(displayLength)} x2={x2} y2={lineY} stroke={LINE_COLOR} strokeWidth={1} />
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
    <div id="export-view" className={styles.exportView}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>{scenario.name}</h1>
        <p className={styles.subtitle}>
          {formatDim(displayLength)}m × {formatDim(displayWidth)}m
        </p>
      </div>

      {/* Floor Plan SVG */}
      <svg
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className={styles.svg}
      >
        {/* Background */}
        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill={COLORS.background} />

        {/* Tent Outline */}
        <rect
          x={toX(0)}
          y={toY(0)}
          width={toS(displayWidth)}
          height={toS(displayLength)}
          fill="rgba(255,255,255,0.3)"
          stroke={COLORS.tentBorder}
          strokeWidth={2}
          rx={3}
        />

        {/* Setback hatching pattern */}
        <defs>
          <pattern id="setbackHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke={COLORS.setbackLine} strokeWidth="1" opacity="0.35" />
          </pattern>
        </defs>

        {/* Setback strips (4 sides) */}
        <g>
          {/* Top strip (open-end start) */}
          {setbackTop > 0.001 && (
            <g>
              <rect x={toX(0)} y={toY(0)} width={toS(displayWidth)} height={toS(setbackTop)}
                fill={COLORS.setbackFill} />
              <rect x={toX(0)} y={toY(0)} width={toS(displayWidth)} height={toS(setbackTop)}
                fill="url(#setbackHatch)" />
            </g>
          )}
          {/* Bottom strip (open-end end) */}
          {setbackBottom > 0.001 && (
            <g>
              <rect x={toX(0)} y={toY(displayLength - setbackBottom)}
                width={toS(displayWidth)} height={toS(setbackBottom)}
                fill={COLORS.setbackFill} />
              <rect x={toX(0)} y={toY(displayLength - setbackBottom)}
                width={toS(displayWidth)} height={toS(setbackBottom)}
                fill="url(#setbackHatch)" />
            </g>
          )}
          {/* Left strip (rail-end) */}
          {setbackLeft > 0.001 && (
            <g>
              <rect x={toX(0)} y={toY(setbackTop)}
                width={toS(setbackLeft)} height={toS(displayLength - setbackTop - setbackBottom)}
                fill={COLORS.setbackFill} />
              <rect x={toX(0)} y={toY(setbackTop)}
                width={toS(setbackLeft)} height={toS(displayLength - setbackTop - setbackBottom)}
                fill="url(#setbackHatch)" />
            </g>
          )}
          {/* Right strip (rail-end) */}
          {setbackRight > 0.001 && (
            <g>
              <rect x={toX(displayWidth - setbackRight)} y={toY(setbackTop)}
                width={toS(setbackRight)} height={toS(displayLength - setbackTop - setbackBottom)}
                fill={COLORS.setbackFill} />
              <rect x={toX(displayWidth - setbackRight)} y={toY(setbackTop)}
                width={toS(setbackRight)} height={toS(displayLength - setbackTop - setbackBottom)}
                fill="url(#setbackHatch)" />
            </g>
          )}

          {/* Inner usable border */}
          <rect
            x={toX(setbackLeft)} y={toY(setbackTop)}
            width={toS(displayWidth - setbackLeft - setbackRight)}
            height={toS(displayLength - setbackTop - setbackBottom)}
            fill="none" stroke={COLORS.setbackLine} strokeWidth={1.5} strokeDasharray="6 3" rx={2}
          />
        </g>

        {/* Rails */}
        <g>
          <rect
            x={toX(setbackLeft)}
            y={toY(setbackTop)}
            width={toS(RAIL_THICKNESS)}
            height={toS(displayLength - setbackTop - setbackBottom)}
            fill={COLORS.rail}
            rx={1}
          />
          <rect
            x={toX(displayWidth - setbackRight - RAIL_THICKNESS)}
            y={toY(setbackTop)}
            width={toS(RAIL_THICKNESS)}
            height={toS(displayLength - setbackTop - setbackBottom)}
            fill={COLORS.rail}
            rx={1}
          />
        </g>

        {/* Columns with braces */}
        {scenario.columns.map((column, colIdx) => {
          const { columnType, position } = column;
          const colorKey = `${columnType.braceLength}×${columnType.braceWidth}`;
          const braceColor = braceColorMap[colorKey] || COLORS.brace;
          const braceBorderColor = darkenColor(braceColor, 16);
          const labelProps = getBraceLabelProps(columnType);

          // Helper: get color by brace dimensions
          const getColorByDims = (bl: number, bw: number) => {
            const key = `${bl}×${bw}`;
            return braceColorMap[key] || COLORS.brace;
          };

          return (
            <g key={colIdx}>
              {columnType.bracePlacements ? (
                // Mixed column: render each placement group sequentially
                (() => {
                  let yOffset = 0;
                  let braceIndex = 0;
                  return columnType.bracePlacements.map((bp, pIdx) => {
                    const bpColor = getColorByDims(bp.braceLength, bp.braceWidth);
                    const bpBorderColor = darkenColor(bpColor, 16);
                    const elements = Array.from({ length: bp.count }, (_, i) => {
                      const bx = toX(position);
                      const by = toY(setbackTop + yOffset);
                      const bw = toS(columnType.columnWidth);
                      const bh = toS(bp.fillLength);
                      yOffset += bp.fillLength;
                      const isFirst = braceIndex === 0;
                      braceIndex++;
                      return (
                        <g key={`${pIdx}-${i}`}>
                          <rect
                            x={bx} y={by} width={bw} height={bh}
                            fill={bpColor}
                            stroke={bpBorderColor} strokeWidth={1} rx={3}
                          />
                          {isFirst && labelProps.show && (
                            labelProps.outside ? (
                              <text x={bx + bw / 2} y={by - 4} textAnchor="middle"
                                className={styles.braceDimLabelOutside}
                                style={{ fontSize: `${labelProps.fontSize}px` }}>
                                Mixed
                              </text>
                            ) : (
                              <text x={bx + bw / 2} y={by + bh / 2 + 4} textAnchor="middle"
                                className={styles.braceDimLabel}
                                style={{ fontSize: `${labelProps.fontSize}px` }}>
                                {formatDim(bp.braceLength)}×{formatDim(bp.braceWidth)}
                              </text>
                            )
                          )}
                        </g>
                      );
                    });
                    return elements;
                  });
                })()
              ) : (
                // Pure column: render uniform braces
                Array.from({ length: columnType.braceCount }, (_, i) => {
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
                        fill={braceColor}
                        stroke={braceBorderColor}
                        strokeWidth={1}
                        rx={3}
                      />
                      {i === 0 && labelProps.show && (
                        labelProps.outside ? (
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
                })
              )}

              {/* Gap */}
              {columnType.gap > 0.001 && (() => {
                const gx = toX(position);
                // Calculate total filled length (different for mixed vs pure)
                const filledLength = columnType.bracePlacements
                  ? columnType.bracePlacements.reduce((sum, bp) => sum + bp.fillLength * bp.count, 0)
                  : columnType.braceCount * columnType.fillLength;
                const gy = toY(setbackTop + filledLength);
                const gw = toS(columnType.columnWidth);
                const gh = toS(columnType.gap);
                return (
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
                );
              })()}
            </g>
          );
        })}

        {/* Setback dimension lines */}
        {renderSetbackDim('top', setbackTop)}
        {renderSetbackDim('bottom', setbackBottom)}
        {renderSetbackDim('left', setbackLeft)}
        {renderSetbackDim('right', setbackRight)}

        {/* Overall dimension labels */}
        <g>
          {/* Width (bottom) */}
          <line
            x1={toX(0)}
            y1={toY(displayLength) + 24}
            x2={toX(displayWidth)}
            y2={toY(displayLength) + 24}
            stroke={COLORS.dimLine}
            strokeWidth={1}
            markerStart="url(#arrowLeft)"
            markerEnd="url(#arrowRight)"
          />
          <rect
            x={toX(displayWidth / 2) - 30}
            y={toY(displayLength) + 15}
            width={60}
            height={20}
            rx={6}
            fill={COLORS.labelBg}
            stroke={COLORS.dimLine}
            strokeWidth={0.5}
          />
          <text
            x={toX(displayWidth / 2)}
            y={toY(displayLength) + 29}
            textAnchor="middle"
            className={styles.measureLabel}
          >
            {formatDim(displayWidth)}m
          </text>

          {/* Length (right) */}
          <line
            x1={toX(displayWidth) + 24}
            y1={toY(0)}
            x2={toX(displayWidth) + 24}
            y2={toY(displayLength)}
            stroke={COLORS.dimLine}
            strokeWidth={1}
            markerStart="url(#arrowUp)"
            markerEnd="url(#arrowDown)"
          />
          <rect
            x={toX(displayWidth) + 14}
            y={toY(displayLength / 2) - 10}
            width={60}
            height={20}
            rx={6}
            fill={COLORS.labelBg}
            stroke={COLORS.dimLine}
            strokeWidth={0.5}
          />
          <text
            x={toX(displayWidth) + 44}
            y={toY(displayLength / 2) + 4}
            textAnchor="middle"
            className={styles.measureLabel}
          >
            {formatDim(displayLength)}m
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

      {/* Legend */}
      <div className={styles.legend}>
        <h3 className={styles.legendTitle}>Legend</h3>
        <div className={styles.legendItems}>
          {braceUsage.map((usage) => (
            <div key={`${usage.length}×${usage.width}`} className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ backgroundColor: usage.color }} />
              <span>{formatDim(usage.length)}×{formatDim(usage.width)}m</span>
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
      </div>

      {/* Inventory Section */}
      <div className={styles.inventory}>
        <h3 className={styles.inventoryTitle}>Used Braces</h3>
        <div className={styles.braceList}>
          {braceUsage.map((usage) => (
            <div key={`${usage.length}×${usage.width}`} className={styles.braceItem}>
              <span className={styles.braceSwatch} style={{ backgroundColor: usage.color }} />
              <span className={styles.braceSize}>
                {formatDim(usage.length)}×{formatDim(usage.width)}m
              </span>
              <span className={styles.braceCount}>× {usage.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Measurements Section */}
      <div className={styles.measurements}>
        <h3 className={styles.measurementsTitle}>Measurements</h3>
        <div className={styles.measurementGrid}>
          <div className={styles.measurementItem}>
            <span className={styles.measurementLabel}>Rail-End Setback:</span>
            <span className={styles.measurementValue}>{formatDim(scenario.setback)}m</span>
          </div>
          <div className={styles.measurementItem}>
            <span className={styles.measurementLabel}>Open-End Start:</span>
            <span className={styles.measurementValue}>{formatDim(scenario.openEndSetbackStart)}m</span>
          </div>
          <div className={styles.measurementItem}>
            <span className={styles.measurementLabel}>Open-End End:</span>
            <span className={styles.measurementValue}>{formatDim(scenario.openEndSetbackEnd)}m</span>
          </div>
          <div className={styles.measurementItem}>
            <span className={styles.measurementLabel}>Total Gap:</span>
            <span className={styles.measurementValue}>{formatDim(scenario.totalGap)}m</span>
          </div>
        </div>
      </div>
    </div>
  );
}
