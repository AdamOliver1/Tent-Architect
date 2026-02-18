import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Column } from '../../types';
import styles from './ColumnPopup.module.scss';

function formatNum(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, '');
}

interface ColumnPopupProps {
  column: Column;
  index: number;
  style: React.CSSProperties;
  onClose: () => void;
  popupRef: RefObject<HTMLDivElement>;
}

export function ColumnPopup({ column, index, style, onClose, popupRef }: ColumnPopupProps) {
  const { t } = useTranslation();

  return (
    <div
      ref={popupRef}
      className={styles.popup}
      style={style}
      role="dialog"
      aria-label={`${t('results.columnNumber')} ${index + 1} ${t('results.columnDetails')}`}
    >
      <div className={styles.header}>
        <h4>
          <span className={styles.badge}>{index + 1}</span>
          {t('results.columnNumber')} {index + 1}
        </h4>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label={t('results.close')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <dl className={styles.details}>
        <div className={styles.row}>
          <dt>{t('results.braceSize')}</dt>
          <dd>
            {formatNum(column.columnType.braceLength)}m ×{' '}
            {formatNum(column.columnType.braceWidth)}m
          </dd>
        </div>

        {/* Secondary brace types in mixed columns */}
        {column.columnType.bracePlacements &&
          column.columnType.bracePlacements
            .filter(
              (bp) =>
                bp.braceLength !== column.columnType.braceLength ||
                bp.braceWidth !== column.columnType.braceWidth
            )
            .map((bp, idx) => (
              <div key={idx} className={styles.row}>
                <dt>{t('results.braceSize')} #{idx + 2}</dt>
                <dd>
                  {formatNum(bp.braceLength)}m × {formatNum(bp.braceWidth)}m
                  {bp.count > 0 && ` (×${bp.count})`}
                </dd>
              </div>
            ))}

        <div className={styles.row}>
          <dt>{t('results.braces')}</dt>
          <dd>{column.columnType.braceCount}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('results.columnWidth')}</dt>
          <dd>{formatNum(column.columnType.columnWidth)}m</dd>
        </div>
        <div className={`${styles.row} ${column.columnType.gap > 0.001 ? styles.rowGap : ''}`}>
          <dt>{t('results.gap')}</dt>
          <dd>{formatNum(column.columnType.gap)}m</dd>
        </div>
      </dl>
    </div>
  );
}
