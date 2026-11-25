'use client';

/**
 * Desktop-3D runtime chunk (dynamic import, requested only on capable desktops):
 * motion runtime (GSAP + ScrollTrigger + Lenis) immediately, the WebGL canvas
 * (three + R3F) as a second chunk. Mobile never downloads either.
 */
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createMotionRuntime, type MotionRuntime } from '@/motion/runtime';
import { loading } from '@/lib/loading';
import { DebugHud } from './DebugHud';

export default function DesktopRuntime() {
  const pathname = usePathname();
  const runtime = useRef<MotionRuntime | null>(null);
  const [SceneCanvas, setSceneCanvas] = useState<ComponentType | null>(null);

  // three.js + R3F arrive as a separate chunk while the preloader runs.
  useEffect(() => {
    let cancelled = false;
    import('@/three/canvas/SceneCanvas').then((m) => {
      if (!cancelled) setSceneCanvas(() => m.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const rt = createMotionRuntime();
    runtime.current = rt;
    loading.done('runtime');
    return () => {
      rt.destroy();
      runtime.current = null;
    };
  }, []);

  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    // Wait a frame so the committed route has laid out (and scroll was restored).
    const id = requestAnimationFrame(() => rt.mountRoute(pathname));
    return () => {
      cancelAnimationFrame(id);
      rt.unmountRoute();
    };
  }, [pathname]);

  return (
    <>
      {SceneCanvas && <SceneCanvas />}
      <DebugHud />
    </>
  );
}
