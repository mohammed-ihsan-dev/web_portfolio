import type { Metadata } from 'next';
import { projects } from '@/data/projects';
import { seo, selectedWork } from '@/data/site';
import { PageIntro } from '@/components/layout/PageIntro';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { WorkIndex } from '@/components/work/WorkIndex';

export const metadata: Metadata = {
  title: seo.pages.work.title,
  description: seo.pages.work.description,
  alternates: { canonical: '/work' },
  openGraph: { title: seo.pages.work.title, description: seo.pages.work.description, url: '/work' },
};

export default function WorkPage() {
  return (
    <div data-page="/work">
      <div className="page">
        <PageIntro kicker="(Index) Selected work" title="Work" count={projects.length} aside={selectedWork.note} />
        <WorkIndex projects={projects} />
      </div>
      <SiteFooter />
    </div>
  );
}
