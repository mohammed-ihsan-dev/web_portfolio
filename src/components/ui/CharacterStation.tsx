import Image from 'next/image';
import type { CharacterState, StationEnter, StationPose } from '@/types/character';
import { characterConfig } from '@/config/character.config';
import styles from './CharacterStation.module.css';

interface Props {
  id: string;
  className?: string;
  /** Looping state while parked here. */
  state?: CharacterState;
  /** One-shot played on arrival (e.g. sitDown, wave). */
  arrive?: CharacterState;
  pose?: StationPose;
  /** Yaw in degrees while parked (0 = facing the viewer, + = turned to his left / screen right). */
  facing?: number;
  enter?: StationEnter;
  prop?: 'desk';
  /** Travel is driven by the hero timeline. */
  hero?: boolean;
  /** ScrollTrigger start/end overrides for the travel window (trigger = station section). */
  travelStart?: string;
  travelEnd?: string;
  /** Render the static cut-out for no-WebGL / reduced-motion visitors. */
  fallback?: boolean;
  priority?: boolean;
  sizes?: string;
}

/**
 * Where the character stands. The box's bottom-centre is the feet; its height
 * is the character's apparent height. CSS positions and sizes it per layout,
 * the WebGL director reads it every frame. In 3D mode it is invisible.
 */
export function CharacterStation({
  id,
  className,
  state = 'idle',
  arrive,
  pose = 'stand',
  facing = 0,
  enter = 'none',
  prop,
  hero,
  travelStart,
  travelEnd,
  fallback = true,
  priority = false,
  sizes = '(min-width: 1024px) 34vw, 60vw',
}: Props) {
  return (
    <span
      className={`${styles.station} ${className ?? ''}`}
      aria-hidden="true"
      data-station={id}
      data-state={state}
      data-arrive={arrive}
      data-pose={pose}
      data-facing={facing}
      data-enter={enter}
      data-prop={prop}
      data-hero={hero ? 'true' : undefined}
      data-travel-start={travelStart}
      data-travel-end={travelEnd}
    >
      {fallback && (
        <Image
          data-station-fallback
          className={styles.fallback}
          src={characterConfig.placeholder.src}
          alt=""
          width={600}
          height={1400}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
        />
      )}
    </span>
  );
}
