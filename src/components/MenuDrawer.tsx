import { useEffect, type ComponentType } from 'react';
import { X, Flame, Users, Heart, Gift, Cherry, Award, Spade, Receipt, Trophy, Gem, Gamepad2, Target, Dices, Globe, Fish, Download, Ticket, Headset, type LucideProps } from 'lucide-react';
import type { Page } from '@/types';
import { openModal, closeModal } from '@/hooks/useModalState';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: Page) => void;
}

interface MenuItem {
  label: string;
  icon: ComponentType<LucideProps>;
  page?: Page;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Hot Games', icon: Flame, page: 'home' },
  { label: 'Invite friends', icon: Users, page: 'refer' },
  { label: 'Favorites', icon: Heart },
  { label: 'Promotion', icon: Gift, page: 'promotion' },
  { label: 'Slots', icon: Cherry, page: 'slots' },
  { label: 'Reward Center', icon: Award, page: 'reward' },
  { label: 'Live Casino', icon: Spade },
  { label: 'Manual rebate', icon: Receipt },
  { label: 'Sports', icon: Trophy },
  { label: 'VIP', icon: Gem },
  { label: 'E-sports', icon: Gamepad2 },
  { label: 'Mission', icon: Target },
  { label: 'Poker', icon: Dices },
  { label: 'Language', icon: Globe },
  { label: 'Fish', icon: Fish },
  { label: 'APP Download', icon: Download },
  { label: 'Lottery', icon: Ticket },
  { label: 'Customer Service', icon: Headset },
];

export default function MenuDrawer({ isOpen, onClose, onNavigate }: MenuDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    openModal();
    return () => closeModal();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleItemClick = (item: MenuItem) => {
    if (!item.page) return;
    onNavigate(item.page);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9998] flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside
        className="relative h-full w-[72%] max-w-[300px] overflow-y-auto bg-dark-bg border-r border-dark-border px-3 pb-8 pt-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="font-display text-base font-bold text-white">Menu</h2>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const available = Boolean(item.page);
            return (
              <button
                key={item.label}
                onClick={() => handleItemClick(item)}
                disabled={!available}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-4 text-center transition-all ${
                  available
                    ? 'border-dark-border bg-dark-card text-white hover:border-neon-green/40 active:scale-95'
                    : 'cursor-default border-dark-border/60 bg-dark-card/50 text-gray-400'
                }`}
              >
                <Icon size={26} className={available ? 'text-neon-gold' : 'text-gray-500'} />
                <span className="text-xs font-semibold leading-tight">{item.label}</span>
                {!available && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
