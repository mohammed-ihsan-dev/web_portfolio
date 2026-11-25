import { HeroIntro } from '@/components/sections/HeroIntro';
import { Expertise } from '@/components/sections/Expertise';
import { SelectedWork } from '@/components/sections/SelectedWork';
import { Workspace } from '@/components/sections/Workspace';
import { OffTheScreen } from '@/components/sections/OffTheScreen';
import { ContactScene } from '@/components/sections/ContactScene';

/** Desktop homepage: server-rendered semantic sections. Motion and WebGL attach from the desktop runtime chunk. */
export function DesktopHome() {
  return (
    <>
      <HeroIntro />
      <Expertise />
      <SelectedWork />
      <Workspace />
      <OffTheScreen />
      <ContactScene />
    </>
  );
}
