import type { TentDimensions } from '../../types';
import styles from './TentInput.module.scss';

interface TentInputProps {
  tent: TentDimensions;
  onChange: (tent: TentDimensions) => void;
  disabled?: boolean;
}

export function TentInput({ tent, onChange, disabled }: TentInputProps) {
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
      <h3 className={styles.title}>Tent Dimensions</h3>
      <div className={styles.inputs}>
        <div className={styles.field}>
          <label htmlFor="tent-length">Length (m)</label>
          <input
            id="tent-length"
            type="number"
            min="0.5"
            step="0.1"
            value={tent.length}
            onChange={handleLengthChange}
            disabled={disabled}
          />
          <span className={styles.hint}>Rail direction</span>
        </div>
        <div className={styles.field}>
          <label htmlFor="tent-width">Width (m)</label>
          <input
            id="tent-width"
            type="number"
            min="0.5"
            step="0.1"
            value={tent.width}
            onChange={handleWidthChange}
            disabled={disabled}
          />
          <span className={styles.hint}>Column direction</span>
        </div>
      </div>
    </div>
  );
}
