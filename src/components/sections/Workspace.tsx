import { workspace } from '@/data/site';
import { CharacterStation } from '@/components/ui/CharacterStation';
import styles from './Workspace.module.css';

/**
 * Scene 07 — a minimal studio. The desk, chair and monitor are rendered by the
 * shared canvas at this station (prop="desk"); the character walks in from the
 * left and sits down to work once a rigged model with sit/typing clips exists.
 */
export function Workspace() {
  return (
    <section className={styles.section} data-station-section aria-labelledby="workspace-title">
      <div className={`layer-front ${styles.sticky}`}>
        <p className={`mono ${styles.kicker}`}>{workspace.kicker}</p>
        <h2 id="workspace-title" className={`title ${styles.title}`}>
          {workspace.title.map((l) => (
            <span key={l} data-reveal="lines">
              {l}
            </span>
          ))}
        </h2>
        <p className={`small ${styles.paragraph}`} data-reveal="lines">
          {workspace.paragraph}
        </p>

        <div className={styles.lists}>
          <div data-reveal="fade">
            <p className="mono muted">Tools</p>
            <ul className={styles.list}>
              {workspace.tools.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div data-reveal="fade">
            <p className="mono muted">Experiments</p>
            <ul className={styles.list}>
              {workspace.experiments.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <CharacterStation
          id="desk"
          className={styles.station}
          prop="desk"
          pose="sit"
          arrive="sitDown"
          state="typing"
          enter="left"
          facing={125}
          travelStart="top 80%"
          travelEnd="top top"
        />
        <span className={`mono ${styles.caption}`}>Fig. 04 — Desk, chair, monitor (procedural)</span>
      </div>
    </section>
  );
}
