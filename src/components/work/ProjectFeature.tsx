import Image from 'next/image';
import type { Project } from '@/types/content';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import styles from './ProjectFeature.module.css';

/** One row of the asymmetric home grid. Layout comes from `project.layout`, alternating sides by index. */
export function ProjectFeature({ project, index }: { project: Project; index: number }) {
  const number = String(index + 1).padStart(2, '0');
  return (
    <li className={styles.item} data-layout={project.layout} data-side={index % 2 === 0 ? 'left' : 'right'} data-flight-row>
      <TransitionLink
        href={`/work/${project.slug}`}
        className={styles.link}
        flipId={project.slug}
        transitionLabel={project.title}
      >
        <figure className={`layer-back ${styles.media}`} data-reveal="image" data-flight-media data-look>
          <div className={styles.mediaInner} data-parallax="7">
            <Image
              src={project.cover.src}
              alt=""
              width={project.cover.width}
              height={project.cover.height}
              sizes="(min-width: 1024px) 60vw, 100vw"
              data-flip-source={project.slug}
              className={styles.img}
            />
          </div>
        </figure>
        <div className={`layer-front ${styles.meta}`}>
          <span className={`mono ${styles.num}`}>({number})</span>
          <h3 className={styles.title}>
            <span data-reveal="lines">{project.title}</span>
          </h3>
          <dl className={`mono ${styles.details}`} data-reveal="fade">
            <div>
              <dt>Category</dt>
              <dd>{project.category}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{project.role}</dd>
            </div>
            <div>
              <dt>{project.year ? 'Year' : 'Type'}</dt>
              <dd>{project.year ?? project.type}</dd>
            </div>
          </dl>
          <span className={`small ${styles.view}`} aria-hidden="true">
            View project
            <ArrowIcon />
          </span>
        </div>
      </TransitionLink>
    </li>
  );
}
