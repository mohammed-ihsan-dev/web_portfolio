import type { Metadata, Viewport } from 'next';
import { fontMono, fontSans } from './fonts';
import '@/styles/globals.css';
import { SITE_URL } from '@/config/site.config';
import { person, seo, socials } from '@/data/site';
import { prePaintScript } from '@/lib/pre-paint';
import { ExperienceProvider } from '@/components/experience/ExperienceProvider';
import { TransitionProvider } from '@/components/transitions/TransitionProvider';
import { Header } from '@/components/layout/Header';
import { GridLines } from '@/components/layout/GridLines';
import { Preloader } from '@/components/experience/Preloader';
import { JsonLd } from '@/components/layout/JsonLd';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: seo.defaultTitle, template: seo.titleTemplate },
  description: seo.description,
  applicationName: seo.siteName,
  authors: [{ name: person.name }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: seo.siteName,
    title: seo.defaultTitle,
    description: seo.description,
    url: '/',
    images: [{ url: seo.ogImage.src, width: seo.ogImage.width, height: seo.ogImage.height, alt: seo.ogImage.alt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: seo.defaultTitle,
    description: seo.description,
    images: [seo.ogImage.src],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#fbfbf9',
  colorScheme: 'light',
};

const personLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: person.name,
      jobTitle: person.role,
      email: `mailto:${person.email}`,
      url: SITE_URL,
      sameAs: socials.map((s) => s.href),
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: seo.siteName,
      description: seo.description,
      publisher: { '@id': `${SITE_URL}/#person` },
      inLanguage: 'en',
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prePaintScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ExperienceProvider>
          <TransitionProvider>
            <GridLines />
            <Header />
            <main id="main" tabIndex={-1}>
              {children}
            </main>
            <Preloader />
          </TransitionProvider>
        </ExperienceProvider>
        <JsonLd data={personLd} />
      </body>
    </html>
  );
}
