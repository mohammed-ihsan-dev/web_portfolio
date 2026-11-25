/**
 * Scroll API used by UI code (menu, transitions, back-to-top). Native by
 * default; the desktop motion runtime swaps in Lenis so smooth scrolling and
 * ScrollTrigger stay in sync. Mobile never loads Lenis.
 */
type ScrollImpl = {
  to: (target: number | HTMLElement, opts?: { immediate?: boolean }) => void;
  lock: () => void;
  unlock: () => void;
};

const native: ScrollImpl = {
  to(target, opts) {
    const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: y, behavior: opts?.immediate || reduce ? 'instant' : 'smooth' });
  },
  lock() {
    document.documentElement.style.overflow = 'hidden';
  },
  unlock() {
    document.documentElement.style.overflow = '';
  },
};

let impl: ScrollImpl = native;

export const scroll = {
  to: (target: number | HTMLElement, opts?: { immediate?: boolean }) => impl.to(target, opts),
  lock: () => impl.lock(),
  unlock: () => impl.unlock(),
  use(next: ScrollImpl | null) {
    impl = next ?? native;
  },
};
