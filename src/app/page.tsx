import { HomeSwitch } from '@/components/experience/HomeSwitch';
import { DesktopHome } from '@/components/desktop/DesktopHome';
import { MobileHome } from '@/components/mobile/MobileHome';

export default function HomePage() {
  return (
    <div data-page="/">
      <HomeSwitch desktop={<DesktopHome />} mobile={<MobileHome />} />
    </div>
  );
}
