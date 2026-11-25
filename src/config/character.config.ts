/**
 * Character asset configuration — the only file to touch when the rigged GLB arrives.
 *
 * While `model.url` is null the scene renders the 2D placeholder cut-out
 * (a camera-facing plane). That placeholder has no skeleton: it cannot sit,
 * walk, wave or blink, and the code never pretends otherwise.
 */
import type { CharacterState, ClipSpec } from '@/types/character';
import placeholderMeta from '../../public/images/character/placeholder.meta.json';

export const characterConfig = {
  /** World height in metres. Everything (props, stations) is scaled around this. */
  height: 1.75,

  model: {
    /** e.g. '/models/character/character.glb' — Meshopt-compressed, Mixamo skeleton. */
    url: null as string | null,
    /** Extra uniform scale applied after auto-normalising to `height`. */
    scale: 1,
    /** Rotate if the export faces -Z instead of +Z. */
    yaw: 0,
  },

  /** Additional clip files sharing the model's skeleton. Clips are merged by name. */
  animations: [] as string[],

  /** KTX2 textures need the Basis transcoder copied to /public/basis (see README). */
  ktx2: false,

  placeholder: {
    src: '/images/character/placeholder.webp',
    aspect: placeholderMeta.aspect,
    /** Normalised row of the sole baseline inside the image. */
    footY: placeholderMeta.footY,
  },

  /** Procedural layers that only run when a real model is present. */
  procedural: {
    lookAt: { enabled: true, maxYaw: 0.55, maxPitch: 0.3, headShare: 0.65 },
    blink: { enabled: true, minInterval: 2.4, maxInterval: 5.5, duration: 0.14 },
    breathing: { enabled: true, rate: 0.23, amount: 0.012 },
  },

  /** Seat offset: hips position relative to the station's surface point when seated. */
  seat: { height: 0.46, depth: -0.12 },
} as const;

/**
 * State → clip resolution. Names follow Mixamo's defaults so downloads work as-is.
 * See PROJECT_PLAN.md §9 for which clips exist (currently: none).
 */
export const clipMap: Record<CharacterState, ClipSpec> = {
  idle: { names: ['Idle', 'Breathing Idle', 'Happy Idle', 'Standing Idle'], loop: true, fade: 0.4 },
  breathing: { names: ['Breathing Idle'], loop: true, fallback: 'idle' },
  standing: { names: ['Standing', 'Idle'], loop: true, fallback: 'idle' },
  lookAround: { names: ['Looking Around', 'Look Around'], loop: true, fallback: 'idle' },
  walk: { names: ['Walking', 'Walk'], loop: true, inPlace: true, fade: 0.3 },
  run: { names: ['Running', 'Run'], loop: true, inPlace: true, fallback: 'walk', fade: 0.25 },
  jump: { names: ['Jumping', 'Jump'], loop: false, inPlace: true, fallback: 'idle' },
  land: { names: ['Falling To Landing', 'Hard Landing', 'Landing'], loop: false, inPlace: true, fallback: 'idle' },
  sitDown: { names: ['Stand To Sit', 'Sitting Down', 'Sit Down'], loop: false, fallback: 'sitIdle' },
  sitIdle: { names: ['Sitting Idle', 'Sitting', 'Sit Idle'], loop: true, fallback: 'idle' },
  standUp: { names: ['Sit To Stand', 'Standing Up', 'Stand Up'], loop: false, fallback: 'idle' },
  laptopWork: { names: ['Sitting And Typing', 'Typing'], loop: true, fallback: 'typing' },
  typing: { names: ['Typing', 'Sitting And Typing'], loop: true, fallback: 'sitIdle' },
  closeLaptop: { names: ['Close Laptop', 'Closing Laptop'], loop: false, fallback: 'sitIdle' },
  wave: { names: ['Waving', 'Wave', 'Standing Greeting'], loop: false, fallback: 'idle' },
  turn: { names: ['Left Turn', 'Right Turn', 'Turn'], loop: false, fallback: 'idle' },
  think: { names: ['Thinking', 'Think'], loop: true, fallback: 'idle' },
  point: { names: ['Pointing', 'Point'], loop: false, fallback: 'idle' },
};

export const hasCharacterModel = () => Boolean(characterConfig.model.url);
