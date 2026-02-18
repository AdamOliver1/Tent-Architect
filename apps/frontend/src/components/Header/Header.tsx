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
          aria-label={t('nav.home')}
        >
          <img
            className={styles.logoIcon}
            src="/logo.png"
            alt="אחים כץ"
            width="32"
            height="32"
          />
          <span className={styles.logoText}>
            {t('app.companyName')}
          </span>
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
