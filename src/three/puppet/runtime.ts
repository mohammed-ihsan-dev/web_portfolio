/**
 * Shared runtime state between the director (decides what is needed) and the
 * puppet components (load + render). Plain module state, no React per frame.
 */
import type { PuppetId } from './puppets';

/** Puppets whose textures are decoded and meshes built. */
export const readyPuppets = new Set<PuppetId>();
/** Puppets the choreography asked for (mounted + loaded ahead of their scene). */
export const requestedPuppets = new Set<PuppetId>(['hero-macbook', 'hero-closing', 'hero-rising']);
/** Loaded with the scene (behind the preloader): the hero sequence needs them from the first frame. */
export const HERO_PUPPETS: PuppetId[] = ['hero-macbook', 'hero-closing', 'hero-rising'];
