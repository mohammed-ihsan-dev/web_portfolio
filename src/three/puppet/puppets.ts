/**
 * Layered 2D puppets built from the dedicated pose renders (see
 * scripts/prepare-puppets.mjs and assets-src/character/puppets.json).
 *
 * All coordinates in the manifest are SOURCE pixels of the (possibly mirrored)
 * render; `metresPerPx` converts them to world metres at the same character
 * scale as the base pose (normalised by head height).
 */
import manifest from '../../../public/images/character/puppets/manifest.json';

export type PuppetId = 'hero-macbook' | 'hero-closing' | 'hero-rising' | 'flying' | 'walking' | 'desk';
type P2 = [number, number];

export interface WeightRule {
  chain?: P2[];
  bones?: string[];
  parent?: string;
  blend?: number;
  startBlend?: number;
  region?: P2[];
  bone?: string;
  feather?: number;
}

export interface PuppetLayer {
  name: string;
  src: string;
  /** Source-px rect the layer texture covers: x, y, w, h. */
  rect: [number, number, number, number];
  bone: string;
  cell: number;
  cols: number;
  rows: number;
  /** Per cell: '1' has pixels, '.' empty (skipped in the mesh). */
  cover: string;
  weights: WeightRule[];
}

export interface PuppetAsset {
  id: PuppetId;
  width: number;
  height: number;
  mirrored: boolean;
  metresPerPx: number;
  head: { crown: P2; chin: P2 };
  anchors: Record<string, P2>;
  bones: Record<string, { parent: string | null; pivot: P2 }>;
  layers: PuppetLayer[];
  /** Desk set only: desk lines (y = a + b·x in source px) and bottom-row colours for the procedural base. */
  deskTop?: { far: [number, number]; front: [number, number]; ends: [number, number]; bottomColours: [number, [number, number, number]][] };
}

const assets = new Map<string, PuppetAsset>((manifest.puppets as unknown as PuppetAsset[]).map((p) => [p.id, p]));

export const hasPuppet = (id: PuppetId) => assets.has(id);
export const getPuppet = (id: PuppetId) => assets.get(id) ?? null;

/** Source px → puppet-local metres (x right, y up) relative to an anchor. */
export function toLocal(p: PuppetAsset, [x, y]: P2, origin: P2): [number, number] {
  return [(x - origin[0]) * p.metresPerPx, (origin[1] - y) * p.metresPerPx];
}

/** Head centre (a little below the midpoint of crown and chin, i.e. the face) in source px. */
export function headCentre(p: PuppetAsset): P2 {
  const { crown, chin } = p.head;
  return [crown[0] + (chin[0] - crown[0]) * 0.6, crown[1] + (chin[1] - crown[1]) * 0.6];
}

/** Distance between two anchors of a puppet, in metres (dx right, dy up). */
export function anchorOffset(id: PuppetId, from: string, to: string): [number, number] {
  const p = getPuppet(id);
  if (!p) return [0, 0];
  const a = p.anchors[from];
  const b = p.anchors[to];
  if (!a || !b) return [0, 0];
  return toLocal(p, b, a);
}
