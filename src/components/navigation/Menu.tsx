'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { navigation, person, socials } from '@/data/site';
import { scroll } from '@/lib/scroll';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import styles from './Menu.module.css';

/**
 * Editorial menu panel. Dialog semantics: focus moves in on open, Tab is
 * trapped, Escape / backdrop / any link closes, focus returns to the toggle.
 */
export function Menu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    scroll.lock();
    const first = panelRef.current?.querySelector<HTMLElement>('a, button');
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = [toggleRef.current, ...panelRef.current.querySelectorAll<HTMLElement>('a[href], button')].filter(
        Boolean,
      ) as HTMLElement[];
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      scroll.unlock();
    };
  }, [open, close]);

  // Activity may hide this tree on navigation; never come back with the panel open.
  useEffect(() => () => setOpen(false), []);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.toggleText} data-open={open}>
          <span>Menu</span>
          <span aria-hidden="true">Close</span>
        </span>
        <span className={styles.toggleIcon} data-open={open} aria-hidden="true">
          <i />
          <i />
        </span>
        <span className="sr-only">{open ? 'Close navigation' : 'Open navigation'}</span>
      </button>

      <div className={styles.root} data-open={open} inert={!open}>
        <div className={styles.backdrop} onClick={() => close(false)} aria-hidden="true" />
        <div
          ref={panelRef}
          id={panelId}
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <div className={styles.panelHead}>
            <span className="mono">Index</span>
            <span className="mono">({String(navigation.length).padStart(2, '0')})</span>
          </div>
          <nav aria-label="Primary">
            <ol className={styles.links}>
              {navigation.map((item, i) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <li key={item.href} style={{ '--i': i } as React.CSSProperties}>
                    <TransitionLink
                      href={item.href}
                      className={styles.link}
                      aria-current={active ? 'page' : undefined}
                      transitionLabel={item.label}
                      onClick={() => close(false)}
                    >
                      <span className={`mono ${styles.num}`}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={styles.label}>{item.label}</span>
                    </TransitionLink>
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className={styles.foot}>
            <a className={styles.email} href={`mailto:${person.email}`}>
              {person.email}
            </a>
            <ul className={styles.socials}>
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noreferrer noopener">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className={`mono ${styles.status}`}>
              <span className={styles.dot} data-open={person.availability.open} aria-hidden="true" />
              {person.availability.label}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
