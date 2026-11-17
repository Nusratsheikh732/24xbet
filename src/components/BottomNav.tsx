import type { Page } from '@/types';
import navigationImage from '@/components/file_00000000e58c81f4bddacf2be1036288.png';

interface BottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const navigationItems: { id: Page; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'refer', label: 'Invite' },
  { id: 'reward', label: 'Reward' },
  { id: 'profile', label: 'Member' },
];

export default function BottomNav({ onNavigate }: BottomNavProps) {
  return (
    <nav className="pointer-events-auto fixed inset-x-0 bottom-0 z-[9999] block bg-[#001b1a] pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto max-w-md">
        <img
          src={navigationImage}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="block h-auto w-full select-none"
        />
        <div className="absolute inset-0 grid grid-cols-5">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              className="h-full w-full cursor-pointer"
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
