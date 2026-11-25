/** Every animation state the character system understands. */
export type CharacterState =
  | 'idle'
  | 'breathing'
  | 'lookAround'
  | 'standing'
  | 'walk'
  | 'run'
  | 'jump'
  | 'land'
  | 'sitDown'
  | 'sitIdle'
  | 'standUp'
  | 'laptopWork'
  | 'typing'
  | 'closeLaptop'
  | 'wave'
  | 'turn'
  | 'think'
  | 'point';

export interface ClipSpec {
  /** Candidate clip names, first match wins (case-insensitive, `mixamo.com`/`Armature|` prefixes ignored). */
  names: string[];
  loop: boolean;
  /** State to use when no clip matches. Resolved recursively; `idle` is the terminal fallback. */
  fallback?: CharacterState;
  /** Remove horizontal root translation so the director owns position. */
  inPlace?: boolean;
  /** Seconds to crossfade into this state. */
  fade?: number;
}

/** Station poses tell the director how to place the root (feet on surface vs. hips on seat). */
export type StationPose = 'stand' | 'sit';

export type StationEnter = 'none' | 'left' | 'right';
