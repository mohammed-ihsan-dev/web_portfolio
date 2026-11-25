import styles from './PageIntro.module.css';

/** Title block for secondary routes: kicker, oversized title, optional count and aside copy. */
export function PageIntro({
  kicker,
  title,
  count,
  aside,
}: {
  kicker: string;
  title: string;
  count?: number;
  aside?: string;
}) {
  return (
    <header className={styles.intro}>
      <p className={`mono ${styles.kicker}`}>{kicker}</p>
      <h1 className={styles.title} style={{ '--chars': title.length } as React.CSSProperties}>
        <span data-reveal="chars">{title}</span>
        {typeof count === 'number' && <sup className={`mono ${styles.count}`}>({String(count).padStart(2, '0')})</sup>}
      </h1>
      {aside && (
        <p className={`small ${styles.aside}`} data-reveal="lines">
          {aside}
        </p>
      )}
    </header>
  );
}
