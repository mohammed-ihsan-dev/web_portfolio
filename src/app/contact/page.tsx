import type { Metadata } from 'next';
import { seo } from '@/data/site';
import { ContactScene } from '@/components/sections/ContactScene';

export const metadata: Metadata = {
  title: seo.pages.contact.title,
  description: seo.pages.contact.description,
  alternates: { canonical: '/contact' },
  openGraph: { title: seo.pages.contact.title, description: seo.pages.contact.description, url: '/contact' },
};

export default function ContactPage() {
  return (
    <div data-page="/contact">
      <ContactScene variant="page" />
    </div>
  );
}
