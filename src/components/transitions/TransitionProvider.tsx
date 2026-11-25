'use client';

/**
 * Page transitions without an animation library (works on mobile too):
 *   1. a curtain slides up over the page (Web Animations API),
 *   2. the route changes underneath (Next client navigation, no reload),
 *   3. scroll resets — or restores, on back/forward — and the curtain leaves.
 * Project links can pass `flipId`: the clicked image is lifted into a fixed
 * clone that flies into the detail page's hero image slot.
 */
import { createContext, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { scroll } from '@/lib/scroll';
import { emit } from '@/lib/scene-bus';
import styles from './Transition.module.css';

export interface NavigateOptions {
  flipId?: string;
  label?: string;
}

const TransitionContext = createContext<{ navigate: (href: string, opts?: NavigateOptions) => void } | null>(null);

export function useTransitionNav() {
  const ctx = use(TransitionContext);
  if (!ctx) throw new Error('useTransitionNav must be used inside <TransitionProvider>');
  return ctx;
}

const EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const curtainRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);
  const popped = useRef(false);
  const memory = useRef(new Map<string, number>());
  const routeReady = useRef<(() => void) | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const onPop = () => {
      popped.current = true;
    };
    // Remember where we were for every history entry we leave.
    const onScrollSave = () => memory.current.set(window.location.pathname, window.scrollY);
    window.addEventListener('popstate', onPop);
    window.addEventListener('pagehide', onScrollSave);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pagehide', onScrollSave);
    };
  }, []);

  // Route committed: fix scroll before paint, then tell listeners.
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const restoring = popped.current;
    popped.current = false;
    const y = restoring ? (memory.current.get(pathname) ?? 0) : 0;
    scroll.to(y, { immediate: true });
    // Second pass after the new page has laid out (images with reserved size, sticky sections).
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - y) > 2) scroll.to(y, { immediate: true });
    });
    emit('route:change');
    routeReady.current?.();
    routeReady.current = null;
  }, [pathname]);

  const curtain = useCallback(async (phase: 'in' | 'out', label?: string) => {
    const el = curtainRef.current;
    if (!el) return;
    if (phase === 'in') {
      if (labelRef.current) labelRef.current.textContent = label ?? '';
      el.dataset.active = 'true';
      await el.animate([{ transform: 'translate3d(0,100%,0)' }, { transform: 'translate3d(0,0,0)' }], {
        duration: 620,
        easing: EASE,
        fill: 'forwards',
      }).finished;
    } else {
      const anim = el.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-100%,0)' }], {
        duration: 720,
        easing: EASE,
        fill: 'forwards',
      });
      await anim.finished;
      el.getAnimations().forEach((a) => a.cancel());
      el.dataset.active = 'false';
    }
  }, []);

  const navigate = useCallback(
    async (href: string, opts?: NavigateOptions) => {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) {
        window.location.href = href;
        return;
      }
      if (url.pathname === window.location.pathname) {
        scroll.to(0);
        return;
      }
      if (busy.current) return;
      busy.current = true;
      memory.current.set(window.location.pathname, window.scrollY);
      emit('route:leave');

      const animate = !reduced();
      const clone = animate && opts?.flipId ? liftImage(opts.flipId) : null;
      if (animate) await curtain('in', opts?.label);

      const ready = new Promise<void>((resolve) => {
        routeReady.current = resolve;
      });
      router.push(url.pathname + url.search + url.hash, { scroll: false });
      await Promise.race([ready, wait(5000)]);
      await frame();
      await frame();

      if (animate) {
        await Promise.all([clone ? landImage(clone, opts!.flipId!) : Promise.resolve(), curtain('out')]);
      }
      // Move focus to the new content for keyboard and screen-reader users.
      document.getElementById('main')?.focus({ preventScroll: true });
      busy.current = false;
    },
    [router, curtain],
  );

  const value = useMemo(() => ({ navigate }), [navigate]);

  return (
    <TransitionContext value={value}>
      {children}
      <div ref={curtainRef} className={styles.curtain} data-active="false" aria-hidden="true">
        <span ref={labelRef} className={`mono ${styles.label}`} />
      </div>
    </TransitionContext>
  );
}

/* ---------- shared-element image flight ---------- */

function liftImage(id: string): HTMLImageElement | null {
  const src = document.querySelector<HTMLImageElement>(`[data-flip-source="${CSS.escape(id)}"]`);
  if (!src) return null;
  const r = src.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return null;
  const img = document.createElement('img');
  img.src = src.currentSrc || src.src;
  img.alt = '';
  img.className = styles.flip;
  Object.assign(img.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  document.body.appendChild(img);
  return img;
}

async function landImage(img: HTMLImageElement, id: string) {
  const target = document.querySelector<HTMLImageElement>(`[data-flip-target="${CSS.escape(id)}"]`);
  if (!target) {
    img.remove();
    return;
  }
  target.style.opacity = '0';
  const to = target.getBoundingClientRect();
  const from = img.getBoundingClientRect();
  const anim = img.animate(
    [
      { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` },
      { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` },
    ],
    { duration: 900, easing: EASE, fill: 'forwards' },
  );
  await anim.finished;
  try {
    await Promise.race([target.decode(), wait(400)]);
  } catch {
    /* decode can reject for broken images; show whatever we have */
  }
  target.style.opacity = '';
  img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).finished.then(() => img.remove());
}
