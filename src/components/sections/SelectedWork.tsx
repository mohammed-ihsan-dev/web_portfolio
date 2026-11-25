import { featuredProjects, projects } from '@/data/projects';
import { selectedWork } from '@/data/site';
import { CharacterStation } from '@/components/ui/CharacterStation';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { ProjectFeature } from '@/components/work/ProjectFeature';
import styles from './SelectedWork.module.css';

/** Scene 06 — the character sits on the oversized WORK letters while the projects scroll past. */
export function SelectedWork() {
  return (
    <section className={styles.section} aria-labelledby="work-title">
      <header className={styles.head} data-station-section>
        <p className={`mono layer-front ${styles.kicker}`}>{selectedWork.kicker}</p>
        <h2 id="work-title" className={styles.title}>
          <span className={`layer-back ${styles.top}`} data-reveal="chars">
            {selectedWork.top}
          </span>
          <span className={`layer-back ${styles.bottom}`}>
            <span data-reveal="chars">{selectedWork.bottom}</span>
            <sup className={`mono ${styles.count}`}>({String(projects.length).padStart(2, '0')})</sup>
            <CharacterStation id="work" className={styles.station} pose="sit" state="sitIdle" arrive="sitDown" facing={-12} />
          </span>
        </h2>
        <p className={`small layer-front ${styles.note}`} data-reveal="lines">
          {selectedWork.note}
        </p>
      </header>

      <ol className={styles.grid}>
        {featuredProjects.map((p, i) => (
          <ProjectFeature key={p.slug} project={p} index={i} />
        ))}
      </ol>

      <div className={`layer-front ${styles.footer}`}>
        <TransitionLink href="/work" className={styles.cta} transitionLabel="Work">
          <span>{selectedWork.cta}</span>
          <span className={styles.ctaChip}>
            <ArrowIcon />
          </span>
        </TransitionLink>
      </div>
    </section>
  );
}
