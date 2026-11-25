'use client';

/**
 * `?debug` overlay: fps, DPR, render gating, active station, character state,
 * and the clip resolution table (shows MISSING until the rigged GLB is wired).
 */
import { useEffect, useRef, useState } from 'react';
import { bus } from '@/lib/scene-bus';
import { hasCharacterModel } from '@/config/character.config';

export function DebugHud() {
  const [enabled, setEnabled] = useState(false);
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const on = new URLSearchParams(window.location.search).has('debug');
    if (!on) return;
    const show = window.setTimeout(() => setEnabled(true), 0);
    const id = window.setInterval(() => {
      if (!ref.current) return;
      const d = bus.debug;
      ref.current.textContent = [
        `fps ${d.fps}  dpr ${d.dpr}  rendering ${d.rendering ? 'yes' : 'idle'}`,
        `hero ${bus.hero.present ? bus.hero.progress.toFixed(3) : '—'}  station ${d.station || '—'}`,
        `state ${d.state}  model ${hasCharacterModel() ? 'GLB' : 'PLACEHOLDER (2D, no skeleton)'}`,
        `stations ${bus.stations.map((s) => `${s.id}:${s.hero ? 'hero' : s.travel.toFixed(2)}`).join('  ')}`,
        d.clips ? `\nclips\n${d.clips}` : '\nclips: no model loaded — every state is unavailable',
      ].join('\n');
    }, 250);
    return () => {
      clearTimeout(show);
      clearInterval(id);
    };
  }, []);

  if (!enabled) return null;
  return (
    <pre
      ref={ref}
      style={{
        position: 'fixed',
        left: 8,
        bottom: 8,
        zIndex: 300,
        margin: 0,
        padding: '8px 10px',
        maxWidth: 520,
        background: 'rgb(12 12 13 / 0.86)',
        color: '#e4edb4',
        font: '11px/1.45 var(--mono)',
        whiteSpace: 'pre-wrap',
        pointerEvents: 'none',
      }}
    />
  );
}
