'use client';

/**
 * CharacterController — one character, interchangeable renderers:
 *
 *   Rigged3DCharacter       real GLB + AnimationMixer (when characterConfig.model.url is set)
 *   Layered2DCharacter      the reference image on a 2D skeletal mesh (breathing, head, arms, crouch, jump…)
 *   MultiPoseCharacter      dedicated pose images swapped by the choreography (each also rigged when measured)
 *   FrameSequenceCharacter  scroll-scrubbed frame sequences, when any are prepared
 *
 * Layered2D and MultiPose share one component (ImageCharacter): a pose image
 * with a measured rig is a Layered2D pose; switching between poses is MultiPose.
 * The director decides what to show; nothing here depends on a single asset.
 */
import { bus } from '@/lib/scene-bus';
import { hasCharacterModel } from '@/config/character.config';
import { ImageCharacter } from '../character2d/ImageCharacter';
import { FrameSequenceCharacter } from '../character2d/FrameSequenceCharacter';
import { GroundShadow } from '../character2d/GroundShadow';
import { Rigged3DCharacter } from './Rigged3DCharacter';
import { solved } from '../director/director';
import { useFrame } from '@react-three/fiber';

function DebugTap() {
  useFrame(() => {
    const c = solved.character;
    bus.debug.station = c.station;
    bus.debug.state = c.state;
  });
  return null;
}

export function CharacterController() {
  const image = <ImageCharacter />;
  return (
    <>
      <DebugTap />
      {hasCharacterModel() ? <Rigged3DCharacter fallback={image} /> : image}
      <FrameSequenceCharacter />
      <GroundShadow />
    </>
  );
}
