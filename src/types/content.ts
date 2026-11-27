/** Content model. Everything rendered on the site comes from `src/data/*` through these types. */

export interface ImageAsset {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface SocialLink {
  label: string;
  href: string;
  handle: string;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface Capability {
  title: string;
  description: string;
}

export interface Project {
  slug: string;
  title: string;
  category: string;
  role: string;
  /** Omitted when not confirmed (never invented). */
  year?: string;
  /** e.g. 'Live client project'. */
  type: string;
  client: string;
  location?: string;
  summary: string;
  description: string[];
  highlights?: string[];
  /** Empty when not confirmed. */
  stack: string[];
  cover: ImageAsset;
  gallery: ImageAsset[];
  /** Layout hint for the asymmetric home grid. */
  layout: 'wide' | 'tall' | 'medium' | 'small';
  liveUrl?: string;
  /** True while the entry is mock content. Shown as a small tag on the detail page. */
  placeholder: boolean;
}

export interface ExperienceEntry {
  role: string;
  organisation: string;
  period: string;
  location?: string;
  note: string;
  highlights?: string[];
}

export interface Experiment {
  slug: string;
  title: string;
  medium: string;
  year: string;
  image: ImageAsset;
  span: 'wide' | 'tall' | 'square';
}

export interface OffScreenItem {
  title: string;
  note: string;
  image: ImageAsset;
}
