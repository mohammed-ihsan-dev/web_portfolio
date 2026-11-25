'use client';

import type { ReactNode } from 'react';
import { useExperienceMode } from './ExperienceProvider';

/**
 * Server-renders both layouts (CSS shows the right one from the first paint,
 * so there is no flash or layout shift), then keeps only the active tree after
 * hydration. Neither tree imports GSAP, Lenis or three.js; those arrive only
 * through the desktop runtime chunk.
 */
export function HomeSwitch({ desktop, mobile }: { desktop: ReactNode; mobile: ReactNode }) {
  const mode = useExperienceMode();
  const showDesktop = mode !== 'mobile';
  const showMobile = mode === 'pending' || mode === 'mobile';
  return (
    <>
      {showDesktop && <div className="only-desktop">{desktop}</div>}
      {showMobile && <div className="only-mobile">{mobile}</div>}
    </>
  );
}
