/**
 * Declarative reveals. Server-rendered markup opts in with data attributes;
 * nothing is hidden unless this desktop module runs, so mobile, no-JS and
 * reduced-motion visitors always see the content.
 *
 *   data-reveal="lines"  masked line slide (SplitText, re-splits on resize)
 *   data-reveal="chars"  masked character slide for oversized words
 *   data-reveal="fade"   short rise + fade
 *   data-reveal="image"  clip-path wipe + inner image settle
 *   data-parallax="7"    inner element drifts ±7% across the viewport
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

const OWNED = '[data-scene="hero-intro"]';
const BUDGET_MS = 8;

/**
 * Builds one setup task per element, in document order, and runs them in
 * time-boxed batches (first batch synchronously so above-the-fold content is
 * ready before paint). SplitText measuring forces layout; batching keeps every
 * main-thread task short. Returns a cancel function.
 */
export function setupReveals(root: HTMLElement, ctx: gsap.Context): () => void {
  const tasks: Array<{ el: HTMLElement; run: () => void }> = [];
  const els = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)].filter((el) => !el.closest(OWNED));
  const queue = (el: HTMLElement, run: () => void) => tasks.push({ el, run });

  els('[data-reveal="lines"]').forEach((el) => queue(el, () => {
    SplitText.create(el, {
      // Lines are block wrappers around words; the reading order is unchanged, so no aria-label is needed.
      aria: 'none',
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 108,
          duration: 1.15,
          ease: 'expo.out',
          stagger: 0.075,
          scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' },
        }),
    });
  }));

  els('[data-reveal="chars"]').forEach((el) => queue(el, () => {
    // Per-character spans read badly in some screen readers: expose the word once, hide the pieces.
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.dataset.revealLabel = '';
    label.textContent = el.textContent;
    el.before(label);
    el.setAttribute('aria-hidden', 'true');
    ctx.add(() => () => {
      label.remove();
      el.removeAttribute('aria-hidden');
    });
    SplitText.create(el, {
      aria: 'none',
      type: 'chars',
      mask: 'chars',
      // Single oversized words never rewrap, and re-splitting on resize can feed back on
      // itself in WebKit (mask padding nudges sub-pixel widths → ResizeObserver → re-split).
      autoSplit: false,
      onSplit: (self) => {
        // Tight negative tracking makes glyphs overhang their boxes; widen the masks.
        gsap.set(self.masks, { paddingInline: '0.08em', marginInline: '-0.08em' });
        return gsap.from(self.chars, {
          yPercent: 110,
          duration: 1.25,
          ease: 'expo.out',
          stagger: 0.035,
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
        });
      },
    });
  }));

  els('[data-reveal="fade"]').forEach((el) => queue(el, () => {
    gsap.from(el, {
      autoAlpha: 0,
      y: 26,
      duration: 1.1,
      ease: 'expo.out',
      clearProps: 'transform',
      scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' },
    });
  }));

  // Project images in the Selected Work flight are revealed by the flight itself (scenes/selectedWorkFlight).
  els('[data-reveal="image"]:not([data-flight-media])').forEach((el) => queue(el, () => {
    const img = el.querySelector('img');
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' } });
    tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath' });
    if (img) tl.from(img, { scale: 1.22, duration: 1.9, ease: 'expo.out', clearProps: 'transform' }, 0);
  }));

  els('[data-parallax]').forEach((el) => queue(el, () => {
    const amount = Number(el.dataset.parallax) || 6;
    gsap.fromTo(
      el,
      { yPercent: -amount },
      {
        yPercent: amount,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement ?? el, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  }));

  // Document order: what's on screen first gets set up first.
  tasks.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  let i = 0;
  let cancelled = false;
  let handle = 0;
  const runBatch = () => {
    if (cancelled) return;
    const start = performance.now();
    while (i < tasks.length && performance.now() - start < BUDGET_MS) ctx.add(tasks[i++].run);
    if (i < tasks.length) handle = window.setTimeout(runBatch, 0);
    else ScrollTrigger.refresh();
  };
  runBatch();
  return () => {
    cancelled = true;
    clearTimeout(handle);
  };
}
