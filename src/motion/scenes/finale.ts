/**
 * Finale choreography (DOM half): progress of the tall sticky section drives
 * the MacBook opening and the camera flight into its screen (3D half in
 * src/three/scenes/finale/FinaleScene.tsx).
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bus } from '@/lib/scene-bus';

export function setupFinale(root: HTMLElement): () => void {
  const section = root.querySelector<HTMLElement>('[data-scene="finale"]');
  const screen = section?.querySelector<HTMLElement>('[data-finale-screen]') ?? null;
  if (!section || !screen) {
    bus.finale.present = false;
    return () => {};
  }
  bus.finale.present = true;
  bus.finale.screen = screen;
  const prelude = section.querySelector('[data-finale-prelude]');

  const proxy = { p: 0 };
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    onUpdate: () => {
      bus.finale.progress = proxy.p;
    },
  });
  tl.to(proxy, { p: 1, duration: 1 }, 0);
  if (prelude) tl.to(prelude, { autoAlpha: 0, y: -12, duration: 0.08 }, 0.3);

  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      bus.finale.visible = self.isActive;
    },
    onRefresh: (self) => {
      bus.finale.visible = self.isActive;
    },
  });

  return () => {
    bus.finale.present = false;
    bus.finale.visible = false;
    bus.finale.progress = 0;
    bus.finale.screen = null;
    screen.style.transform = '';
    screen.style.visibility = '';
  };
}
