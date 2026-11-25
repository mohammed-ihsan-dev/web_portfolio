import styles from './GridLines.module.css';

/** Fixed architectural column rules (every second column of the 12-col grid). Desktop only. */
export function GridLines() {
  return (
    <div className={styles.lines} aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
