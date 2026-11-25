import { contact, person, socials } from '@/data/site';
import { CharacterStation } from '@/components/ui/CharacterStation';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { BackToTop } from '@/components/ui/BackToTop';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import styles from './ContactScene.module.css';

/**
 * Scene 09 — oversized HELLO, the character walks in from the right, waves once
 * (when a rigged model with a wave clip exists) and settles into idle.
 * `variant="page"` is the /contact route: the character is already there.
 */
export function ContactScene({ variant = 'home' }: { variant?: 'home' | 'page' }) {
  const Heading = variant === 'page' ? 'h1' : 'h2';
  return (
    <section className={styles.section} data-variant={variant} data-station-section aria-labelledby="contact-title">
      <p className={`mono layer-front ${styles.kicker}`}>{contact.kicker}</p>

      <Heading id="contact-title" className={`layer-back ${styles.hello}`}>
        <span className="sr-only">Contact — </span>
        <span data-reveal="chars">{contact.word}</span>
      </Heading>

      <CharacterStation
        id={variant === 'page' ? 'contact-page' : 'hello'}
        className={styles.station}
        enter={variant === 'page' ? 'none' : 'right'}
        arrive="wave"
        state="idle"
        travelStart="top 85%"
        travelEnd="top 5%"
      />

      <div className={`layer-front ${styles.lead}`}>
        <p className="lead" data-reveal="lines">
          {contact.lead}
        </p>
      </div>

      <div className={`layer-front ${styles.email}`}>
        <p className="mono muted">Email</p>
        <a className={styles.address} href={`mailto:${person.email}`}>
          {person.email}
        </a>
        <CopyEmail email={person.email} label={contact.copyLabel} copiedLabel={contact.copiedLabel} />
      </div>

      <ul className={`layer-front ${styles.socials}`}>
        {socials.map((s) => (
          <li key={s.label}>
            <a href={s.href} target="_blank" rel="noreferrer noopener" className={styles.social}>
              <span className="mono muted">{s.label}</span>
              <span className="small">
                {s.handle} <ArrowIcon />
              </span>
            </a>
          </li>
        ))}
      </ul>

      <footer className={`layer-front ${styles.footer}`}>
        <p className={`mono ${styles.status}`}>
          <span className={styles.dot} data-open={person.availability.open} aria-hidden="true" />
          {person.availability.label}
          <span className="muted"> — {person.availability.detail}</span>
        </p>
        <p className="mono muted">
          © {contact.year} {person.name}
        </p>
        <BackToTop label={contact.backToTop} />
      </footer>
    </section>
  );
}
