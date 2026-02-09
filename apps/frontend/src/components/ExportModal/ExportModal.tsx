import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button';
import styles from './ExportModal.module.scss';

interface ExportFormat {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'pdf',
    label: 'PDF Document',
    description: 'High-quality print layout with measurements',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7h8M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'png',
    label: 'PNG Image',
    description: 'Raster image for presentations and sharing',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'cad',
    label: 'CAD (DXF)',
    description: 'Vector format for AutoCAD and engineering tools',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 3h18v18H3V3z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 3l18 18M21 3L3 21" stroke="currentColor" strokeWidth="0.75" opacity="0.3" />
        <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="0.75" opacity="0.3" />
      </svg>
    ),
  },
];

export function ExportModal({ isOpen, onClose, projectName }: ExportModalProps) {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);
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
    // Simulate export delay — real implementation connects to backend
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsExporting(false);
    onClose();
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

        {/* Format options */}
        <div className={styles.formats}>
          {EXPORT_FORMATS.map((format) => (
            <button
              key={format.id}
              className={`${styles.formatCard} ${selectedFormat === format.id ? styles.formatSelected : ''}`}
              onClick={() => setSelectedFormat(format.id)}
              type="button"
              aria-pressed={selectedFormat === format.id}
            >
              <div className={styles.formatIcon}>{format.icon}</div>
              <div className={styles.formatInfo}>
                <span className={styles.formatLabel}>{format.label}</span>
                <span className={styles.formatDesc}>{format.description}</span>
              </div>
              {/* Radio indicator */}
              <div className={styles.radio}>
                <div className={styles.radioInner} />
              </div>
            </button>
          ))}
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
