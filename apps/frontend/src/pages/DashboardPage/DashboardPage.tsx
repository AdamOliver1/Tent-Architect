import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCalculation } from '../../context/CalculationContext';
import { TentInput } from '../../components/TentInput';
import { InventoryEditor } from '../../components/InventoryEditor';
import { Button } from '../../components/Button';
import styles from './DashboardPage.module.scss';

// Example recent projects (would come from persistence layer)
const recentProjects = [
  { id: 1, name: 'Wedding Marquee', dimensions: '30m × 15m', date: 'Jan 28, 2026', columns: 12 },
  { id: 2, name: 'Festival Stage Tent', dimensions: '50m × 20m', date: 'Jan 15, 2026', columns: 18 },
  { id: 3, name: 'Corporate Event', dimensions: '25m × 10m', date: 'Dec 20, 2025', columns: 8 },
];

export function DashboardPage() {
  const { t } = useTranslation();
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

            {error && (
              <div className={styles.error} role="alert">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 6v4M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>{error}</span>
                <button onClick={clearError} type="button" aria-label="Dismiss error">
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

        {/* ── Recent Projects ── */}
        <section className={styles.recentSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 8h14" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 8v9" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <h2 className={styles.sectionTitle}>{t('dashboard.recentProjects')}</h2>
              <p className={styles.sectionDesc}>{t('dashboard.recentProjectsDesc')}</p>
            </div>
          </div>

          <div className={styles.projectGrid}>
            {recentProjects.map((project) => (
              <button
                key={project.id}
                className={styles.projectCard}
                type="button"
                aria-label={`Open ${project.name}`}
              >
                {/* Mini floor plan preview */}
                <div className={styles.projectPreview} aria-hidden="true">
                  <svg viewBox="0 0 120 80" fill="none" className={styles.projectPreviewSvg}>
                    <rect x="10" y="10" width="100" height="60" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                    <rect x="16" y="16" width="18" height="48" rx="1" fill="currentColor" opacity="0.12" />
                    <rect x="38" y="16" width="18" height="48" rx="1" fill="currentColor" opacity="0.12" />
                    <rect x="60" y="16" width="18" height="48" rx="1" fill="currentColor" opacity="0.12" />
                    <rect x="82" y="16" width="22" height="48" rx="1" fill="currentColor" opacity="0.08" />
                  </svg>
                </div>
                <div className={styles.projectInfo}>
                  <h3 className={styles.projectName}>{project.name}</h3>
                  <span className={styles.projectDims}>{project.dimensions}</span>
                </div>
                <div className={styles.projectMeta}>
                  <span>{project.date}</span>
                  <span className={styles.projectDot}>·</span>
                  <span>{project.columns} columns</span>
                </div>
              </button>
            ))}

            {/* Empty template card */}
            <button
              className={`${styles.projectCard} ${styles.projectCardEmpty}`}
              type="button"
              aria-label="Start from template"
            >
              <div className={styles.emptyIcon} aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className={styles.emptyText}>{t('dashboard.startFromTemplate')}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
