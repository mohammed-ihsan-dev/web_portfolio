import { expertise } from '@/data/site';
import { CharacterStation } from '@/components/ui/CharacterStation';
import styles from './Expertise.module.css';

/** Scene 05 — "Creative Developer." The character walks in and points toward the capability index. */
export function Expertise() {
  return (
    <section className={styles.section} data-station-section aria-labelledby="expertise-title">
      <p className={`mono layer-front ${styles.kicker}`}>{expertise.kicker}</p>
      <p className={`small layer-front ${styles.paragraph}`} data-reveal="lines">
        {expertise.paragraph}
      </p>

      <h2 id="expertise-title" className={`layer-back ${styles.title}`}>
        <span className={styles.top} data-reveal="chars">
          {expertise.titleTop}
        </span>
        <span className={styles.bottom} data-reveal="chars">
          {expertise.titleBottom}
        </span>
      </h2>

      <CharacterStation id="expertise" className={styles.station} state="idle" arrive="point" facing={28} />

      <ol className={`layer-front ${styles.list}`} data-look>
        {expertise.capabilities.map((c, i) => (
          <li key={c.title} className={styles.item} data-reveal="fade">
            <span className={`mono ${styles.num}`}>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.itemTitle}>{c.title}</span>
            <span className={`small ${styles.itemDesc}`}>{c.description}</span>
          </li>
        ))}
      </ol>

      <ul className={`mono layer-front ${styles.meta}`}>
        {expertise.meta.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </section>
  );
}
