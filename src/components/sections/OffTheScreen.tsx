import Image from 'next/image';
import { offScreen } from '@/data/site';
import styles from './OffTheScreen.module.css';

/** Scene 08 — personal interests. Asymmetric, quiet; no 3D renders here. */
export function OffTheScreen() {
  return (
    <section className={styles.section} aria-labelledby="offscreen-title">
      <div className={styles.head}>
        <p className={`mono ${styles.kicker}`}>{offScreen.kicker}</p>
        <h2 id="offscreen-title" className={`title ${styles.title}`}>
          {offScreen.title.map((l) => (
            <span key={l} data-reveal="lines">
              {l}
            </span>
          ))}
        </h2>
        <p className={`small ${styles.paragraph}`} data-reveal="lines">
          {offScreen.paragraph}
        </p>
      </div>

      <ul className={styles.grid}>
        {offScreen.items.map((item, i) => (
          <li key={item.title} className={styles.item} data-i={i}>
            <figure>
              <div className={styles.media} data-reveal="image">
                <div className={styles.mediaInner} data-parallax={i % 2 ? '5' : '9'}>
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    width={item.image.width}
                    height={item.image.height}
                    sizes="(min-width: 1024px) 34vw, 90vw"
                    className={styles.img}
                  />
                </div>
              </div>
              <figcaption className={styles.caption}>
                <span className="mono">
                  {String(i + 1).padStart(2, '0')} — {item.title}
                </span>
                <span className="small muted">{item.note}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
