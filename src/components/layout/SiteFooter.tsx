import { contact, person, socials } from '@/data/site';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import { BackToTop } from '@/components/ui/BackToTop';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import styles from './SiteFooter.module.css';

/** Compact footer for secondary routes (the homepage ends on the HELLO scene instead). */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <TransitionLink href="/contact" className={styles.big} transitionLabel="Contact">
        <span>{contact.word}</span>
        <ArrowIcon className={styles.bigArrow} />
      </TransitionLink>
      <div className={styles.row}>
        <a href={`mailto:${person.email}`} className="small">
          {person.email}
        </a>
        <ul className={styles.socials}>
          {socials.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noreferrer noopener" className="small">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mono muted">
          © {contact.year} {person.name}. {contact.credit}
        </p>
        <BackToTop label={contact.backToTop} />
      </div>
    </footer>
  );
}
