import { Home, Ticket, Share2, Award, Gem } from 'lucide-react';
import type { Page } from '@/types';
import { useModalActive } from '@/hooks/useModalState';

interface BottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const leftItems: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'promotion', label: 'Promotion', icon: Ticket },
];

const rightItems: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'reward', label: 'Reward', icon: Award },
  { id: 'profile', label: 'Member', icon: Gem },
];

const INVITE_PAGE: Page = 'refer';

export default function BottomNav({ activePage, onNavigate }: BottomNavProps) {
  const modalActive = useModalActive();

  if (modalActive) return null;

  const renderItem = (item: { id: Page; label: string; icon: typeof Home }) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className="relative flex flex-1 flex-col items-center gap-1 py-2 transition-all active:scale-90"
      >
        <Icon
          size={22}
          strokeWidth={isActive ? 2.25 : 1.75}
          className={isActive ? 'text-amber-300' : 'text-[#5ef0c1]'}
        />
        <span
          className={`text-[11px] font-semibold ${isActive ? 'text-amber-300' : 'text-gray-300'}`}
        >
          {item.label}
        </span>
        {isActive && (
          <span className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-amber-300" />
        )}
      </button>
    );
  };

  const isInviteActive = activePage === INVITE_PAGE;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-[#1f6f63] bg-[#0b3f37]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <div className="relative mx-auto flex max-w-md items-end px-2">
        {leftItems.map(renderItem)}

        <div className="flex flex-1 justify-center">
          <button
            onClick={() => onNavigate(INVITE_PAGE)}
            aria-label="Invite"
            className="-mt-6 flex flex-col items-center gap-1 transition-all active:scale-90"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#5ef0c1]/60 bg-gradient-to-b from-[#1b8c78] to-[#0b5a4d] shadow-[0_0_18px_rgba(94,240,193,0.35)] ${
                isInviteActive ? 'ring-2 ring-amber-300' : ''
              }`}
            >
              <Share2 size={24} className="text-white" />
            </span>
            <span
              className={`text-[11px] font-semibold ${isInviteActive ? 'text-amber-300' : 'text-gray-300'}`}
            >
              Invite
            </span>
          </button>
        </div>

        {rightItems.map(renderItem)}
      </div>
    </nav>
  );
}
