import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Constraints } from '../../types';
import styles from './ConstraintsEditor.module.scss';

interface ConstraintsEditorProps {
  constraints: Constraints;
  onChange: (constraints: Constraints) => void;
  disabled?: boolean;
}

export function ConstraintsEditor({
  constraints,
  onChange,
  disabled,
}: ConstraintsEditorProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (field: keyof Constraints, raw: string) => {
    const value = parseFloat(raw);
    if (!isNaN(value) && value >= 0) {
      onChange({ ...constraints, [field]: value });
    }
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        aria-expanded={isExpanded}
      >
        <div className={styles.headerLeft}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
          >
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3>{t('constraints.title')}</h3>
        </div>
      </button>

      {isExpanded && (
        <div className={styles.content}>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="min-setback" className={styles.label}>
                {t('constraints.minSetback')}
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="min-setback"
                  type="number"
                  min="0"
                  max="2"
                  step="0.01"
                  value={constraints.minSetback}
                  onChange={(e) => handleChange('minSetback', e.target.value)}
                  disabled={disabled}
                  className={styles.input}
                />
                <span className={styles.unit}>m</span>
              </div>
              <span className={styles.hint}>{t('constraints.minSetbackHint')}</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="max-setback" className={styles.label}>
                {t('constraints.maxSetback')}
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="max-setback"
                  type="number"
                  min="0"
                  max="2"
                  step="0.01"
                  value={constraints.maxSetback}
                  onChange={(e) => handleChange('maxSetback', e.target.value)}
                  disabled={disabled}
                  className={styles.input}
                />
                <span className={styles.unit}>m</span>
              </div>
              <span className={styles.hint}>{t('constraints.maxSetbackHint')}</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="max-column-gap" className={styles.label}>
                {t('constraints.maxColumnGap')}
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="max-column-gap"
                  type="number"
                  min="0"
                  max="5"
                  step="0.01"
                  value={constraints.maxColumnGap}
                  onChange={(e) => handleChange('maxColumnGap', e.target.value)}
                  disabled={disabled}
                  className={styles.input}
                />
                <span className={styles.unit}>m</span>
              </div>
              <span className={styles.hint}>{t('constraints.maxColumnGapHint')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
