import { HeroIntro } from '@/components/sections/HeroIntro';
import { SelectedWork } from '@/components/sections/SelectedWork';
import { Workspace } from '@/components/sections/Workspace';
import { OffTheScreen } from '@/components/sections/OffTheScreen';
import { Finale } from '@/components/sections/Finale';

/** Desktop homepage: server-rendered semantic sections. Motion and WebGL attach from the desktop runtime chunk. */
export function DesktopHome() {
  return (
    <>
      <HeroIntro />
      <SelectedWork />
      <Workspace />
      <OffTheScreen />
      <Finale />
    </>
  );
}
