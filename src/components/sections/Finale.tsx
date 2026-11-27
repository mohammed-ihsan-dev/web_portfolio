import { contact, person, socials } from '@/data/site';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { BackToTop } from '@/components/ui/BackToTop';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import styles from './Finale.module.css';

/**
 * Finale — the MacBook from the opening returns, opens, and the camera flies
 * into its screen. The footer below IS the screen: on desktop-3d it is
 * projected onto the 3D display with a per-frame CSS homography
 * (src/three/scenes/finale/FinaleScene.tsx) that becomes the identity at the
 * end, so the visitor lands inside a real, selectable HTML footer — no swap,
 * no fade. Everywhere else it is simply the footer.
 */
export function Finale() {
  return (
    <section className={styles.section} data-scene="finale" aria-labelledby="finale-title">
      <div className={styles.stage}>
        <p className={`mono ${styles.prelude}`} data-finale-prelude>
          (07) One more thing
        </p>
        <footer className={styles.screen} data-finale-screen>
          <div className={styles.top}>
            <p className="mono">{contact.kicker}</p>
            <p className={`mono ${styles.status}`}>
              <span className={styles.dot} data-open={person.availability.open} aria-hidden="true" />
              {person.availability.label}
            </p>
          </div>

          <h2 id="finale-title" className={styles.title}>
            {contact.heading}
          </h2>
          <p className={styles.lead}>{contact.lead}</p>

          <div className={styles.actions}>
            <a className={styles.address} href={`mailto:${person.email}`}>
              {person.email}
            </a>
            <CopyEmail email={person.email} label={contact.copyLabel} copiedLabel={contact.copiedLabel} />
            <a className={styles.talk} href={`mailto:${person.email}?subject=Let%E2%80%99s%20talk`}>
              {contact.talkLabel} <ArrowIcon />
            </a>
          </div>

          <div className={styles.bottom}>
            <ul className={styles.socials}>
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noreferrer noopener">
                    {s.label} <ArrowIcon />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mono">
              © {contact.year} {person.name}. {contact.credit}
            </p>
            <BackToTop label={contact.backToTop} />
          </div>
        </footer>
      </div>
    </section>
  );
}
