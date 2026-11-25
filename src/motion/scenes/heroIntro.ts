/**
 * Scenes 02–04 choreography (DOM half). One scrubbed timeline over the tall
 * sticky section; its progress is mirrored to `bus.hero.progress`, which the
 * WebGL director uses for the 3D half. Both read the same smoothed value, so
 * text and 3D stay locked together forwards and backwards.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bus, on } from '@/lib/scene-bus';
import { loading } from '@/lib/loading';
import { heroTimeline as T } from './heroTimeline';

export function setupHeroIntro(root: HTMLElement): () => void {
  const section = root.querySelector<HTMLElement>('[data-scene="hero-intro"]');
  if (!section) {
    bus.hero.present = false;
    return () => {};
  }
  bus.hero.present = true;

  const q = gsap.utils.selector(section);
  const hlLines = q('[data-hl-line]');
  const hlExit = q('[data-hl-exit]');
  const fades = q('[data-hero-fade]');
  const cue = q('[data-hero-cue]');
  const chars = q('[data-char]');
  const introCopy = q('[data-intro-copy]');

  gsap.set(chars, { yPercent: 112 });
  gsap.set(introCopy, { autoAlpha: 0, y: 18 });

  /* ---------- entrance, once the preloader lifts ---------- */
  const entrance = gsap.timeline({ paused: true });
  entrance
    .from(hlLines, { yPercent: 112, duration: 1.35, ease: 'expo.out', stagger: 0.1 }, 0.1)
    .from(fades, { autoAlpha: 0, y: 14, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 0.45)
    .from(cue, { autoAlpha: 0, duration: 0.9, ease: 'power2.out' }, 0.9)
    .fromTo(bus.hero, { entrance: 0 }, { entrance: 1, duration: 2.4, ease: 'power3.out' }, 0);

  let offDone = () => {};
  if (loading.finished) entrance.progress(1);
  else offDone = on('preloader:done', () => entrance.play());

  /* ---------- scrubbed hero → intro sequence ---------- */
  const proxy = { p: 0 };
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.8,
      invalidateOnRefresh: false,
    },
    onUpdate: () => {
      bus.hero.progress = proxy.p;
    },
  });
  tl.to(proxy, { p: 1, duration: 1 }, 0);
  tl.to(cue, { autoAlpha: 0, duration: 0.03 }, 0.005);
  tl.to(hlExit, { yPercent: -115, duration: T.headlineOut[1] - T.headlineOut[0], ease: 'power2.in', stagger: 0.02 }, T.headlineOut[0]);
  tl.to(fades, { autoAlpha: 0, y: -10, duration: 0.07, stagger: 0.01 }, T.headlineOut[0] + 0.01);
  tl.to(chars, { yPercent: 0, duration: 0.18, ease: 'power3.out', stagger: (T.name[1] - T.name[0] - 0.18) / Math.max(1, chars.length - 1) }, T.name[0]);
  tl.to(introCopy, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out', stagger: 0.025 }, T.copy[0]);

  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      bus.hero.visible = self.isActive;
    },
    onRefresh: (self) => {
      bus.hero.visible = self.isActive;
    },
  });

  return () => {
    offDone();
    entrance.kill();
    bus.hero.present = false;
    bus.hero.progress = 0;
  };
}
