/**
 * Builds the station list for the visible route and wires each station's
 * travel progress to scroll. The WebGL director reads `bus.stations`.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bus, type StationRecord } from '@/lib/scene-bus';
import type { CharacterState, StationEnter, StationPose } from '@/types/character';

const DEG = Math.PI / 180;

export function setupStations(root: HTMLElement) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-station]')];
  bus.stations = els.map((el, index) => {
    const d = el.dataset;
    const section = el.closest<HTMLElement>('[data-station-section]') ?? el.closest<HTMLElement>('section') ?? el;
    const rec: StationRecord = {
      id: d.station!,
      el,
      section,
      index,
      travel: 0,
      enter: (d.enter as StationEnter) || 'none',
      pose: (d.pose as StationPose) || 'stand',
      state: (d.state as CharacterState) || 'idle',
      arrive: (d.arrive as CharacterState) || null,
      facing: Number(d.facing || 0) * DEG,
      prop: d.prop === 'desk' ? 'desk' : null,
      hero: d.hero === 'true',
    };

    if (rec.hero) return rec;

    // The first station on a page (with no entrance) is simply there.
    if (index === 0 && rec.enter === 'none') {
      rec.travel = 1;
      return rec;
    }

    ScrollTrigger.create({
      trigger: section,
      start: d.travelStart || 'top bottom',
      end: d.travelEnd || 'top top',
      onUpdate: (self) => {
        rec.travel = self.progress;
      },
      onRefresh: (self) => {
        rec.travel = self.progress;
      },
    });
    return rec;
  });

  bus.lookTargets = [...root.querySelectorAll<HTMLElement>('[data-look]')];
  bus.panelSlots = [...root.querySelectorAll<HTMLElement>('[data-panel-slot]')];
  bus.layoutVersion++;
}
