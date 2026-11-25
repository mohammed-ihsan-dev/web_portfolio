import type { Metadata } from 'next';
import Image from 'next/image';
import { experiments } from '@/data/projects';
import { seo } from '@/data/site';
import { PageIntro } from '@/components/layout/PageIntro';
import { SiteFooter } from '@/components/layout/SiteFooter';
import styles from './playground.module.css';

export const metadata: Metadata = {
  title: seo.pages.playground.title,
  description: seo.pages.playground.description,
  alternates: { canonical: '/playground' },
  openGraph: { title: seo.pages.playground.title, description: seo.pages.playground.description, url: '/playground' },
};

export default function PlaygroundPage() {
  return (
    <div data-page="/playground">
      <div className="page">
        <PageIntro
          kicker="(Lab) Creative experiments"
          title="Playground"
          count={experiments.length}
          aside="Placeholder. Small studies in shaders, motion and type. Every tile below is mock artwork."
        />
        <ul className={styles.grid}>
          {experiments.map((e, i) => (
            <li key={e.slug} className={styles.item} data-span={e.span} data-i={i}>
              <figure>
                <div className={styles.media} data-reveal="image">
                  <div className={styles.mediaInner} data-parallax="6">
                    <Image src={e.image.src} alt={e.image.alt} width={e.image.width} height={e.image.height} sizes="(min-width: 1024px) 40vw, 92vw" />
                  </div>
                </div>
                <figcaption className={styles.caption}>
                  <span className={styles.title}>{e.title}</span>
                  <span className="mono muted">
                    {e.medium} — {e.year}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
      <SiteFooter />
    </div>
  );
}
