import Image from 'next/image';
import { hero, intro, person } from '@/data/site';
import { characterConfig } from '@/config/character.config';
import { CharacterStation } from '@/components/ui/CharacterStation';
import { Annotation } from '@/components/ui/Annotation';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import styles from './HeroIntro.module.css';

/**
 * Scenes 02–04 — hero, scroll transition, personal intro.
 *
 * 3D mode: one tall section with two sticky 100vh stages.
 *   back  (z1): CSS sky fallback + oversized name the character stands in front of
 *   front (z3): headline, labels, intro copy
 * The shared canvas (z2) renders between them. Progress through the section
 * drives the whole sequence (src/motion/scenes/heroIntro.ts).
 *
 * Static / no-JS: the stages collapse (`display: contents`) into two stacked
 * screens — hero, then intro — with the character cut-out in both.
 */
export function HeroIntro() {
  const nameChars = Array.from(person.name);
  return (
    <section className={styles.section} data-scene="hero-intro" aria-labelledby="hero-title">
      {/* ---------- back layer ---------- */}
      <div className={styles.back}>
        <div className={styles.intro} data-station-section>
          <h2 className={styles.name} data-intro-name>
            <span className="sr-only">{person.name}</span>
            <span className={styles.nameRow} aria-hidden="true">
              {nameChars.map((c, i) =>
                c === ' ' ? (
                  <span key={i} className={styles.space} />
                ) : (
                  <span key={i} className={styles.charMask}>
                    <span className={styles.char} data-char>
                      {c}
                    </span>
                  </span>
                ),
              )}
            </span>
          </h2>
          <CharacterStation id="intro" hero state="idle" className={styles.introStation} sizes="(min-width: 1024px) 30vw, 1px" />
        </div>

        <div className={styles.sky} data-hero-fallback aria-hidden="true">
          <span className={styles.cloudA} />
          <span className={styles.cloudB} />
          <Image
            className={styles.skyFigure}
            src={characterConfig.placeholder.src}
            alt=""
            width={600}
            height={1400}
            sizes="(min-width: 1024px) 22vw, 1px"
            // Lazy on purpose: on phones this desktop-only figure is display:none and must not
            // compete with the mobile LCP image. On desktop it is in view, so it loads at once.
            loading="lazy"
            data-station-fallback
          />
        </div>
      </div>

      {/* ---------- front layer ---------- */}
      <div className={styles.front}>
        <div className={styles.heroFront} data-hero-front>
          <h1 id="hero-title" className={styles.headline}>
            <span className="sr-only">
              {person.name}, {person.role}.{' '}
            </span>
            {hero.headline.map((line) => (
              <span key={line} className={styles.hlMask}>
                <span className={styles.hlExit} data-hl-exit>
                  <span className={styles.hlLine} data-hl-line>
                    {line}
                  </span>
                </span>
              </span>
            ))}
          </h1>

          <div className={styles.annotation} data-hero-fade>
            <Annotation lines={hero.annotation} />
          </div>

          <div className={styles.heroCopy} data-hero-fade>
            <p className="mono">{hero.label}</p>
            <p className="small">{hero.intro}</p>
          </div>

          <p className={`mono ${styles.status}`} data-hero-fade>
            <span className={styles.dot} aria-hidden="true" />
            {person.availability.label}
          </p>

          <div className={styles.cue} data-hero-cue aria-hidden="true">
            <span className="mono">{hero.scrollCue}</span>
            <span className={styles.cueLine}>
              <i />
            </span>
          </div>
        </div>

        <div className={styles.introFront}>
          <p className={`mono ${styles.kicker}`} data-intro-copy>
            {intro.kicker}
          </p>
          <p className={`small ${styles.bio}`} data-intro-copy>
            {intro.bio}
          </p>
          <TransitionLink href="/about" className={`small ${styles.aboutLink}`} data-intro-copy transitionLabel="About">
            {intro.aboutCta}
            <ArrowIcon direction="right" />
          </TransitionLink>
          <dl className={`mono ${styles.meta}`}>
            {intro.meta.map((m) => (
              <div key={m.label} data-intro-copy>
                <dt>{m.label}</dt>
                <dd>{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
