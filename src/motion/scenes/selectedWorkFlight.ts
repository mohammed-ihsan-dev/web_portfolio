/**
 * Selected Work flight (DOM half). Each project row gets a scrubbed progress
 * window; the WebGL director flies the character across while the row's image
 * opens behind him (clip-path driven by the same path function). Any number of
 * rows works: directions alternate automatically.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bus } from '@/lib/scene-bus';
import { flightDir, flightReveal } from '../flightPath';

export function setupSelectedWorkFlight(root: HTMLElement): () => void {
  const rows = [...root.querySelectorAll<HTMLElement>('[data-flight-row]')];
  if (!rows.length) {
    bus.flight.rows = [];
    return () => {};
  }
  const records = rows.map((el, index) => {
    const media = el.querySelector<HTMLElement>('[data-flight-media]') ?? el;
    const img = media.querySelector<HTMLElement>('img');
    return { el, media, img, index, progress: 0 };
  });
  bus.flight.rows = records;

  const apply = (r: (typeof records)[number]) => {
    const rect = r.media.getBoundingClientRect();
    const dir = flightDir(r.index);
    const k = flightReveal(r.progress, dir, rect, window.innerWidth);
    const hidden = `${((1 - k) * 100).toFixed(2)}%`;
    r.media.style.clipPath = dir > 0 ? `inset(0% ${hidden} 0% 0%)` : `inset(0% 0% 0% ${hidden})`;
    if (r.img) r.img.style.transform = `scale(${(1.12 - 0.12 * k).toFixed(4)})`;
  };

  const triggers = records.map((r) =>
    ScrollTrigger.create({
      trigger: r.media,
      start: 'top 78%',
      end: 'center 22%',
      onUpdate: (self) => {
        r.progress = self.progress;
        apply(r);
      },
      onRefresh: (self) => {
        r.progress = self.progress;
        apply(r);
      },
    }),
  );

  return () => {
    triggers.forEach((t) => t.kill());
    for (const r of records) {
      r.media.style.clipPath = '';
      if (r.img) r.img.style.transform = '';
    }
    bus.flight.rows = [];
  };
}
