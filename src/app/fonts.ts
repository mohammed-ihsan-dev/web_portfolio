import { IBM_Plex_Mono, Instrument_Sans } from 'next/font/google';

/** Self-hosted at build time (no runtime request to Google). */
export const fontSans = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
});
