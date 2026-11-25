/**
 * Shared runtime state between the director (decides) and the image character
 * components (load + render). Plain module state: no React re-renders per frame.
 */
import type { PoseId } from './poses';

/** Poses whose texture is decoded and whose mesh is built. */
export const readyPoses = new Set<PoseId>();
/** Poses the choreography asked for (the component mounts and loads them). */
export const requestedPoses = new Set<PoseId>();
