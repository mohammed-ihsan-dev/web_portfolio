import { person } from '@/data/site';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import { Menu } from '@/components/navigation/Menu';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <TransitionLink href="/" className={styles.wordmark} transitionLabel="Home">
        <span className={styles.mark} aria-hidden="true">
          {person.initials}
        </span>
        <span className={styles.name}>{person.name}</span>
      </TransitionLink>
      <p className={`mono ${styles.center}`}>
        <span>{person.role}</span>
        <span className={styles.sep} aria-hidden="true">
          /
        </span>
        <span>{person.location}</span>
      </p>
      <Menu />
    </header>
  );
}
