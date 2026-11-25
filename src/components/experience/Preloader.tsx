'use client';

import { useEffect, useRef } from 'react';
import { experienceConfig } from '@/config/site.config';
import { person } from '@/data/site';
import { loading } from '@/lib/loading';
import { emit } from '@/lib/scene-bus';
import { useExperienceMode } from './ExperienceProvider';
import styles from './Preloader.module.css';

/**
 * Desktop-3D only (CSS keeps it hidden elsewhere, and it never renders without JS).
 * The counter follows weighted real progress: fonts, the runtime chunk, and the
 * scene (three.js chunk + LoadingManager + first frame). Hard cap at
 * `preloaderMaxMs`, so content is never held hostage by a slow asset.
 */
export function Preloader() {
  const mode = useExperienceMode();
  const rootRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (mode !== 'desktop-3d' || !html.classList.contains('is-preloading')) return;

    const { preloaderMinMs, preloaderMaxMs } = experienceConfig;
    const start = performance.now();
    let target = 0;
    let shown = 0;
    let allDone = false;
    let raf = 0;
    let exiting = false;

    loading.add('fonts', 1);
    loading.add('runtime', 1);
    loading.add('scene', 3);
    document.fonts.ready.then(() => loading.done('fonts'));

    const unsub = loading.subscribe((p, done) => {
      target = p;
      allDone = done;
    });
    const cap = window.setTimeout(() => {
      target = 1;
      allDone = true;
    }, preloaderMaxMs);

    const markSteps = () => {
      stepsRef.current?.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => {
        const t = Number(el.dataset.step);
        el.dataset.done = String(shown >= t);
      });
    };

    const finish = async () => {
      exiting = true;
      loading.markFinished();
      const root = rootRef.current;
      if (root) {
        root.dataset.exit = 'true';
        await root.animate([{ clipPath: 'inset(0 0 0% 0)' }, { clipPath: 'inset(0 0 100% 0)' }], {
          duration: 1100,
          delay: 380,
          easing: 'cubic-bezier(0.76, 0, 0.24, 1)',
          fill: 'forwards',
        }).finished;
      }
      html.classList.remove('is-preloading');
      emit('preloader:done');
    };

    const loop = () => {
      // Ease toward real progress; a tiny floor keeps the number alive while a chunk downloads.
      const ceiling = allDone ? 1 : Math.min(0.97, target + 0.04);
      shown = Math.min(ceiling, shown + Math.max((ceiling - shown) * (allDone ? 0.14 : 0.075), allDone ? 0.025 : 0.0006));
      const value = Math.round(shown * 100);
      if (countRef.current) countRef.current.textContent = String(value).padStart(3, '0');
      if (barRef.current) barRef.current.style.transform = `scaleX(${shown})`;
      markSteps();
      const elapsed = performance.now() - start;
      if (!exiting && allDone && shown >= 0.999 && elapsed >= preloaderMinMs) {
        finish();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(cap);
      unsub();
    };
  }, [mode]);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <div className={styles.top}>
        <span className={styles.word}>{person.name}</span>
        <span className="mono">{person.role}</span>
      </div>
      <ol ref={stepsRef} className={`mono ${styles.steps}`}>
        <li data-step="0.15">Type</li>
        <li data-step="0.45">Scene</li>
        <li data-step="0.9">Character</li>
      </ol>
      <div className={styles.bottom}>
        <span className={styles.countMask}>
          <span ref={countRef} className={styles.count}>
            000
          </span>
        </span>
        <span className={`mono ${styles.caption}`}>Loading experience</span>
      </div>
      <span className={styles.track}>
        <span ref={barRef} className={styles.bar} />
      </span>
    </div>
  );
}
