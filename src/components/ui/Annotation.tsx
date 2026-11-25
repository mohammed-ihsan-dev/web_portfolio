import styles from './Annotation.module.css';

/** Hand-drawn arrow + two-line note pointing at the character. */
export function Annotation({ lines, direction = 'left' }: { lines: readonly string[]; direction?: 'left' | 'right' }) {
  return (
    <p className={styles.note} data-direction={direction}>
      <svg className={styles.arrow} viewBox="0 0 64 40" fill="none" aria-hidden="true">
        <path
          d="M62 30c-9 5.5-22 7-33 2.5C18 28 11 19 7.5 7.5"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          pathLength={1}
        />
        <path d="M2.8 13.2 7 6.2l6.9 4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={styles.text}>
        {lines.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </span>
    </p>
  );
}
