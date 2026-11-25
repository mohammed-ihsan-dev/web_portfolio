/**
 * Weighted loading tracker for the preloader. Tasks report real progress
 * (fonts, the 3D chunk, three.js LoadingManager). No fake timers.
 */
type Listener = (progress: number, done: boolean) => void;

const tasks = new Map<string, { weight: number; progress: number }>();
const listeners = new Set<Listener>();
let finished = false;

function total() {
  let w = 0;
  let p = 0;
  tasks.forEach((t) => {
    w += t.weight;
    p += t.weight * t.progress;
  });
  return w === 0 ? 0 : p / w;
}

function notify() {
  const p = total();
  const done = tasks.size > 0 && [...tasks.values()].every((t) => t.progress >= 1);
  listeners.forEach((fn) => fn(p, done));
}

export const loading = {
  add(id: string, weight = 1) {
    if (!tasks.has(id)) tasks.set(id, { weight, progress: 0 });
    notify();
  },
  set(id: string, progress: number) {
    const t = tasks.get(id);
    if (!t) return;
    t.progress = Math.max(t.progress, Math.min(1, progress));
    notify();
  },
  done(id: string) {
    this.set(id, 1);
  },
  /** Abandon a task (e.g. 3D disabled) without blocking the preloader. */
  skip(id: string) {
    const t = tasks.get(id);
    if (t) {
      t.progress = 1;
      notify();
    }
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    fn(total(), false);
    return () => {
      listeners.delete(fn);
    };
  },
  get finished() {
    return finished;
  },
  markFinished() {
    finished = true;
  },
};
