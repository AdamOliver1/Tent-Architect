import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.scss';

export function Header() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value;
    i18n.changeLanguage(newLanguage);
  };

  const languages = [
    { code: 'en', label: t('language.english') },
    { code: 'he', label: t('language.hebrew') },
    { code: 'ar', label: t('language.arabic') },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* Logo / Wordmark */}
        <button
          className={styles.logo}
          onClick={() => navigate('/')}
          type="button"
          aria-label="Go to homepage"
        >
          {/* Tent icon */}
          <svg
            className={styles.logoIcon}
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M14 3L3 23h22L14 3z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M14 3v20"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M8 15l6 8 6-8"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
              fill="none"
              opacity="0.5"
            />
          </svg>
          <span className={styles.logoText}>Tent Architect</span>
        </button>

        {/* Right section */}
        <div className={styles.actions}>
          {!isHome && (
            <button
              className={styles.backBtn}
              onClick={() => navigate('/')}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('nav.dashboard')}
            </button>
          )}

          <div className={styles.langWrapper}>
            <svg className={styles.langIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.5 8h13M8 1.5c-2 2-2.5 4-2.5 6.5s.5 4.5 2.5 6.5c2-2 2.5-4 2.5-6.5S10 3.5 8 1.5z" stroke="currentColor" strokeWidth="1" />
            </svg>
            <select
              id="language-select"
              className={styles.langSelect}
              value={i18n.language}
              onChange={handleLanguageChange}
              aria-label={t('language.select')}
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
