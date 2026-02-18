import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCalculation } from '../../context/CalculationContext';
import { TentInput } from '../../components/TentInput';
import { InventoryEditor } from '../../components/InventoryEditor';
import { ConstraintsEditor } from '../../components/ConstraintsEditor';
import { Button } from '../../components/Button';
import { formatValidationError } from '../../utils/formatValidationError';
import styles from './DashboardPage.module.scss';

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    tent,
    inventory,
    constraints,
    isLoading,
    error,
    setTent,
    setInventory,
    setConstraints,
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
    <div className={styles.page}>
      {/* ── Hero section ── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{t('dashboard.heroTitle')}</h1>
          <p className={styles.heroSubtitle}>{t('dashboard.heroSubtitle')}</p>
        </div>

        {/* Decorative tent silhouette */}
        <div className={styles.heroDecor} aria-hidden="true">
          <svg viewBox="0 0 480 160" fill="none" className={styles.heroSvg}>
            <path
              d="M40 140 L160 30 L280 140"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.15"
            />
            <path
              d="M160 30 L160 140"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.1"
            />
            <path
              d="M200 140 L320 50 L440 140"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.08"
            />
            <path
              d="M320 50 L320 140"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.06"
            />
          </svg>
        </div>
      </section>

      <div className={styles.content}>
        {/* ── New Project Form ── */}
        <section className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className={styles.sectionTitle}>{t('dashboard.newProject')}</h2>
              <p className={styles.sectionDesc}>{t('dashboard.newProjectDesc')}</p>
            </div>
          </div>

          <div className={styles.formBody}>
            <TentInput tent={tent} onChange={setTent} disabled={isLoading} />

            {inventory && (
              <InventoryEditor
                inventory={inventory}
                onChange={setInventory}
                disabled={isLoading}
              />
            )}

            <ConstraintsEditor
              constraints={constraints}
              onChange={setConstraints}
              disabled={isLoading}
            />

            {error && (
              <div className={styles.error} role="alert">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 6v4M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className={styles.errorMessage}>{formatValidationError(error, t)}</span>
                <button onClick={clearError} type="button" aria-label={t('error.dismiss')}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            <div className={styles.generateWrapper}>
              <Button
                size="large"
                onClick={handleGenerate}
                disabled={!isValid}
                isLoading={isLoading}
                icon={
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3L3 17h14L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M10 3v14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                }
              >
                {t('button.generate')}
              </Button>
            </div>
          </div>
        </section>

        {/* ── Recent Projects — In Development ── */}
        <section className={styles.recentSection}>
          <p className={styles.recentInDev}>{t('dashboard.recentProjectsInDev')}</p>
        </section>
      </div>
    </div>
  );
}
