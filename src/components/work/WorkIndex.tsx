import Image from 'next/image';
import type { Project } from '@/types/content';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import styles from './WorkIndex.module.css';

/** Editorial index of every project. The thumbnail is the shared-element source for the detail page. */
export function WorkIndex({ projects }: { projects: Project[] }) {
  return (
    <ol className={styles.list}>
      <li className={`mono ${styles.head}`} aria-hidden="true">
        <span>No.</span>
        <span>Project</span>
        <span>Category</span>
        <span>Year</span>
        <span />
      </li>
      {projects.map((p, i) => (
        <li key={p.slug} className={styles.row} data-reveal="fade">
          <TransitionLink href={`/work/${p.slug}`} className={styles.link} flipId={p.slug} transitionLabel={p.title}>
            <span className={`mono ${styles.num}`}>({String(i + 1).padStart(2, '0')})</span>
            <span className={styles.title}>{p.title}</span>
            <span className={`mono ${styles.cat}`}>{p.category}</span>
            <span className={`mono ${styles.year}`}>{p.year ?? p.type}</span>
            <span className={styles.thumb}>
              <Image
                src={p.cover.src}
                alt=""
                width={p.cover.width}
                height={p.cover.height}
                sizes="(min-width: 1024px) 18vw, 40vw"
                data-flip-source={p.slug}
              />
              <span className={styles.arrow}>
                <ArrowIcon />
              </span>
            </span>
          </TransitionLink>
        </li>
      ))}
    </ol>
  );
}
