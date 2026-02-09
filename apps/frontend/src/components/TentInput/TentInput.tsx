import { useTranslation } from 'react-i18next';
import type { TentDimensions } from '../../types';
import styles from './TentInput.module.scss';

interface TentInputProps {
  tent: TentDimensions;
  onChange: (tent: TentDimensions) => void;
  disabled?: boolean;
}

export function TentInput({ tent, onChange, disabled }: TentInputProps) {
  const { t } = useTranslation();
  const handleLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      onChange({ ...tent, length: value });
    }
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      onChange({ ...tent, width: value });
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{t('tent.dimensions')}</h3>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="tent-length" className={styles.label}>
            {t('tent.length')}
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="tent-length"
              type="number"
              min="0.5"
              step="0.1"
              value={tent.length}
              onChange={handleLengthChange}
              disabled={disabled}
              className={styles.input}
            />
            <span className={styles.unit}>m</span>
          </div>
          <span className={styles.hint}>{t('tent.lengthHint')}</span>
        </div>

        {/* Visual separator — the "×" symbol */}
        <div className={styles.separator} aria-hidden="true">×</div>

        <div className={styles.field}>
          <label htmlFor="tent-width" className={styles.label}>
            {t('tent.width')}
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="tent-width"
              type="number"
              min="0.5"
              step="0.1"
              value={tent.width}
              onChange={handleWidthChange}
              disabled={disabled}
              className={styles.input}
            />
            <span className={styles.unit}>m</span>
          </div>
          <span className={styles.hint}>{t('tent.widthHint')}</span>
        </div>
      </div>
    </div>
  );
}
