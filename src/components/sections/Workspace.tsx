import { workspace } from '@/data/site';
import { CharacterStation } from '@/components/ui/CharacterStation';
import styles from './Workspace.module.css';

/**
 * Scene 07 — the studio. The shared canvas draws the desk set at this station
 * (prop="desk"): the character walks in from the left, stops at the chair, sits
 * and works at the monitor. The station box's bottom-centre is the floor under
 * the chair; its height is his standing height.
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
          {workspace.lists.map((list) => (
            <div key={list.label} data-reveal="fade">
              <p className="mono muted">{list.label}</p>
              <ul className={styles.list}>
                {list.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
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
          travelStart="top 72%"
          travelEnd="top 24%"
        />
        <span className={`mono ${styles.caption}`}>Fig. 04 — The desk</span>
      </div>
    </section>
  );
}
