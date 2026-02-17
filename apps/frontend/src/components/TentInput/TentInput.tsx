import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TentDimensions } from '../../types';
import styles from './TentInput.module.scss';

interface TentInputProps {
  tent: TentDimensions;
  onChange: (tent: TentDimensions) => void;
  disabled?: boolean;
}

const isValidNumericInput = (value: string): boolean => {
  return /^\d*\.?\d*$/.test(value);
};

export function TentInput({ tent, onChange, disabled }: TentInputProps) {
  const { t } = useTranslation();

  const [lengthText, setLengthText] = useState(String(tent.length));
  const [widthText, setWidthText] = useState(String(tent.width));
  const prevLengthRef = useRef(tent.length);
  const prevWidthRef = useRef(tent.width);

  useEffect(() => {
    if (prevLengthRef.current !== tent.length) {
      prevLengthRef.current = tent.length;
      setLengthText(String(tent.length));
    }
  }, [tent.length]);

  useEffect(() => {
    if (prevWidthRef.current !== tent.width) {
      prevWidthRef.current = tent.width;
      setWidthText(String(tent.width));
    }
  }, [tent.width]);

  const handleLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!isValidNumericInput(raw)) return;
    setLengthText(raw);
    const value = Number.parseFloat(raw);
    if (!Number.isNaN(value) && value > 0) {
      onChange({ ...tent, length: value });
    }
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!isValidNumericInput(raw)) return;
    setWidthText(raw);
    const value = Number.parseFloat(raw);
    if (!Number.isNaN(value) && value > 0) {
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
              type="text"
              inputMode="decimal"
              value={lengthText}
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
              type="text"
              inputMode="decimal"
              value={widthText}
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
