import { useNavigate } from 'react-router-dom';
import { useCalculation } from '../../context/CalculationContext';
import { TentInput } from '../../components/TentInput';
import { InventoryEditor } from '../../components/InventoryEditor';
import { Button } from '../../components/Button';
import styles from './DashboardPage.module.scss';

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    tent,
    inventory,
    isLoading,
    error,
    setTent,
    setInventory,
    calculate,
    clearError,
  } = useCalculation();

  const handleGenerate = async () => {
    clearError();
    const success = await calculate();
    if (success) {
      navigate('/results');
    }
  };

  const isValid = tent.length > 0 && tent.width > 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Tent Floor Planner</h1>
        <p>Configure your tent dimensions and generate optimized floor plans</p>
      </header>

      <main className={styles.main}>
        <div className={styles.form}>
          <TentInput tent={tent} onChange={setTent} disabled={isLoading} />

          {inventory && (
            <InventoryEditor
              inventory={inventory}
              onChange={setInventory}
              disabled={isLoading}
            />
          )}

          {error && (
            <div className={styles.error}>
              <span>{error}</span>
              <button onClick={clearError} type="button">
                ×
              </button>
            </div>
          )}

          <Button
            size="large"
            onClick={handleGenerate}
            disabled={!isValid}
            isLoading={isLoading}
          >
            Generate Floor Plan
          </Button>
        </div>

        <aside className={styles.info}>
          <h3>How it works</h3>
          <ol>
            <li>Enter your tent dimensions (length × width)</li>
            <li>Optionally customize available braces and rails</li>
            <li>Click "Generate" to calculate optimal floor layouts</li>
            <li>Compare up to 3 optimized scenarios</li>
          </ol>

          <h3>Key concepts</h3>
          <dl>
            <dt>Rails</dt>
            <dd>5cm thick beams running along the tent length</dd>
            <dt>Braces</dt>
            <dd>Floor panels that fill the space between rails</dd>
            <dt>Setback</dt>
            <dd>Minimum 15cm clearance from tent edges</dd>
            <dt>Gaps</dt>
            <dd>Unfilled areas at the ends of columns</dd>
          </dl>
        </aside>
      </main>
    </div>
  );
}
