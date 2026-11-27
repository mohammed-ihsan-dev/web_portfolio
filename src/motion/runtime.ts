/**
 * Desktop motion runtime: one loop for everything.
 *
 *   gsap.ticker → Lenis.raf → (Lenis 'scroll') ScrollTrigger.update → tick hooks (WebGL render)
 *
 * Route-level choreography lives in a gsap.context scoped to the visible page
 * root and is reverted on route change (Next keeps hidden routes mounted with
 * Activity, so we always target the visible one).
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { bus, on, runTickHooks } from '@/lib/scene-bus';
import { scroll } from '@/lib/scroll';
import { setupReveals } from './reveals';
import { setupStations } from './stations';
import { setupHeroIntro } from './scenes/heroIntro';
import { setupFinale } from './scenes/finale';
import { setupSelectedWorkFlight } from './scenes/selectedWorkFlight';
import { requestedPuppets } from '@/three/puppet/runtime';

gsap.registerPlugin(ScrollTrigger, SplitText);

export interface MotionRuntime {
  mountRoute: (path: string) => void;
  unmountRoute: () => void;
  destroy: () => void;
  lenis: Lenis;
}

const scrollKey = (path: string) => `scroll:${path}`;

/** On a reload (not a fresh visit) the page comes back where it was; every scene is a pure function of scroll. */
function reloadScroll(path: string) {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type !== 'reload') return 0;
    return Number(sessionStorage.getItem(scrollKey(path)) || 0);
  } catch {
    return 0;
  }
}

function findPageRoot(): HTMLElement | null {
  const pages = document.querySelectorAll<HTMLElement>('[data-page]');
  for (const el of pages) {
    const visible = typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.offsetParent !== null;
    if (visible) return el;
  }
  return null;
}

export function createMotionRuntime(): MotionRuntime {
  const lenis = new Lenis({
    autoRaf: false,
    lerp: 0.09,
    wheelMultiplier: 0.95,
    smoothWheel: true,
    anchors: true,
  });
  bus.enabled = true;

  lenis.on('scroll', (l: Lenis) => {
    bus.scroll.y = l.animatedScroll;
    bus.scroll.velocity = l.velocity;
    ScrollTrigger.update();
  });

  let last = performance.now();
  const tick = (time: number) => {
    lenis.raf(time * 1000);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    runTickHooks(now, dt);
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  scroll.use({
    to: (target, opts) => lenis.scrollTo(target, { immediate: opts?.immediate, force: true, duration: 1.4 }),
    lock: () => lenis.stop(),
    unlock: () => lenis.start(),
  });

  // Hold scroll while the preloader is up.
  if (document.documentElement.classList.contains('is-preloading')) lenis.stop();
  const offPreloader = on('preloader:done', () => lenis.start());

  const onPointer = (e: PointerEvent) => {
    bus.pointer.x = e.clientX;
    bus.pointer.y = e.clientY;
    bus.pointer.nx = (e.clientX / window.innerWidth) * 2 - 1;
    bus.pointer.ny = -((e.clientY / window.innerHeight) * 2 - 1);
    bus.pointer.active = true;
  };
  const onLeave = () => {
    bus.pointer.active = false;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  const onRefresh = () => {
    bus.layoutVersion++;
  };
  ScrollTrigger.addEventListener('refresh', onRefresh);

  let ctx: gsap.Context | null = null;
  let cleanups: Array<() => void> = [];
  let firstMount = true;
  const onPageHide = () => {
    try {
      sessionStorage.setItem(scrollKey(bus.route), String(Math.round(window.scrollY)));
    } catch {
      /* storage unavailable: a reload simply starts at the top */
    }
  };
  window.addEventListener('pagehide', onPageHide);

  return {
    lenis,
    mountRoute(path) {
      const root = findPageRoot();
      if (!root) return;
      bus.route = path;
      const context = gsap.context(() => {
        cleanups.push(setupHeroIntro(root));
        cleanups.push(setupFinale(root));
        cleanups.push(setupSelectedWorkFlight(root));
        setupStations(root);
      }, root);
      ctx = context;
      ScrollTrigger.refresh();
      if (firstMount) {
        firstMount = false;
        const y = reloadScroll(path);
        if (y > 0) {
          // load the renders of every scene up front (the preloader is still up)
          requestedPuppets.add('flying');
          requestedPuppets.add('walking');
          requestedPuppets.add('desk');
          lenis.scrollTo(Math.min(y, document.documentElement.scrollHeight - window.innerHeight), { immediate: true, force: true });
          ScrollTrigger.update();
        }
      }
      cleanups.push(setupReveals(root, context));
    },
    unmountRoute() {
      cleanups.forEach((fn) => fn());
      cleanups = [];
      ctx?.revert();
      ctx = null;
      bus.stations = [];
      bus.lookTargets = [];
      bus.panelSlots = [];
      bus.hero.present = false;
      bus.hero.visible = false;
    },
    destroy() {
      this.unmountRoute();
      gsap.ticker.remove(tick);
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pagehide', onPageHide);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      offPreloader();
      scroll.use(null);
      lenis.destroy();
      bus.enabled = false;
    },
  };
}
