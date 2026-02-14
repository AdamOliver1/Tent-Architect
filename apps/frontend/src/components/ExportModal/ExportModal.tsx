import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Scenario } from '../../types';
import { Button } from '../Button';
import { ExportView } from '../ExportView';
import { exportToPNG, generateExportFilename } from '../../utils/export';
import styles from './ExportModal.module.scss';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  scenario: Scenario;
  tentDimensions: { length: number; width: number };
  braceColorMap: Record<string, string>;
}

export function ExportModal({
  isOpen,
  onClose,
  projectName,
  scenario,
  tentDimensions,
  braceColorMap,
}: ExportModalProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Handle open/close with native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      // Generate filename
      const filename = generateExportFilename(scenario.name, tentDimensions);

      // Wait a bit to ensure the hidden ExportView is rendered
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Export the hidden view as PNG
      await exportToPNG('export-view', filename);

      // Close modal on success
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={handleBackdropClick}
      aria-label={t('export.title')}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{t('export.title')}</h2>
            {projectName && (
              <p className={styles.subtitle}>{projectName}</p>
            )}
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('export.close')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Export description */}
        <div className={styles.content}>
          <p className={styles.description}>
            Export your floor plan as a high-quality PNG image including the visualization,
            used braces inventory, and all measurements.
          </p>
          {error && (
            <div className={styles.error} role="alert">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6v4M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Hidden ExportView for capture */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <ExportView
            scenario={scenario}
            tentDimensions={tentDimensions}
            braceColorMap={braceColorMap}
          />
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            {t('export.cancel')}
          </Button>
          <Button
            variant="accent"
            onClick={handleExport}
            isLoading={isExporting}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12v2h12v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            {t('export.download')}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
