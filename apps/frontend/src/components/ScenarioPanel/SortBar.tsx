import { useTranslation } from 'react-i18next';
import styles from './SortBar.module.scss';

export type SortOption = 'default' | 'gap' | 'setback' | 'braces' | 'columns';
export type SortDirection = 'asc' | 'desc';

interface SortBarProps {
  sortBy: SortOption;
  sortDir: SortDirection;
  onSortByChange: (value: SortOption) => void;
  onSortDirToggle: () => void;
}

export function SortBar({ sortBy, sortDir, onSortByChange, onSortDirToggle }: SortBarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.sortBar}>
      <select
        className={styles.sortSelect}
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as SortOption)}
        aria-label={t('results.sortBy')}
      >
        <option value="default">{t('results.sortDefault')}</option>
        <option value="gap">{t('results.sortGap')}</option>
        <option value="setback">{t('results.sortSetback')}</option>
        <option value="braces">{t('results.sortBraces')}</option>
        <option value="columns">{t('results.sortColumns')}</option>
      </select>
      <button
        type="button"
        className={`${styles.sortDirBtn} ${sortBy === 'default' ? styles.sortDirDisabled : ''}`}
        onClick={onSortDirToggle}
        disabled={sortBy === 'default'}
        aria-label={sortDir === 'asc' ? t('results.sortAsc') : t('results.sortDesc')}
        title={sortDir === 'asc' ? t('results.sortAsc') : t('results.sortDesc')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          {sortDir === 'asc' ? (
            <path d="M7 2v10M3.5 5.5 7 2l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M7 12V2M3.5 8.5 7 12l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
    </div>
  );
}
