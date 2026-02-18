import { useTranslation } from 'react-i18next';
import styles from './ZoomControls.module.scss';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  minZoom?: number;
  maxZoom?: number;
}

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitToView,
  minZoom = 0.25,
  maxZoom = 4,
}: ZoomControlsProps) {
  const { t } = useTranslation();
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className={styles.container} role="toolbar" aria-label={t('zoom.controls')}>
      {/* Zoom out */}
      <button
        className={styles.btn}
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        aria-label={t('zoom.out')}
        title={t('zoom.out')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Zoom level indicator */}
      <button
        className={styles.level}
        onClick={onFitToView}
        title={t('zoom.fitToView')}
        aria-label={t('zoom.level', { percent: zoomPercent })}
      >
        {zoomPercent}%
      </button>

      {/* Zoom in */}
      <button
        className={styles.btn}
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        aria-label={t('zoom.in')}
        title={t('zoom.in')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className={styles.divider} />

      {/* Fit to view */}
      <button
        className={styles.btn}
        onClick={onFitToView}
        aria-label={t('zoom.fitToView')}
        title={t('zoom.fitToView')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 6V3a1 1 0 011-1h3M10 2h3a1 1 0 011 1v3M14 10v3a1 1 0 01-1 1h-3M6 14H3a1 1 0 01-1-1v-3"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
