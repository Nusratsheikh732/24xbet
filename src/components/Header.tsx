import { useState, useRef } from 'react';
import { Wallet, Plus, Menu } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import MenuDrawer from '@/components/MenuDrawer';
import type { Page } from '@/types';

interface HeaderProps {
  balance: number;
  onDeposit: () => void;
  onAdminAccess: () => void;
  onNavigate: (page: Page) => void;
}

export default function Header({ balance, onDeposit, onAdminAccess, onNavigate }: HeaderProps) {
  const { t, bn } = useLanguage();
  const [tapCount, setTapCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = () => {
    const next = tapCount + 1;
    setTapCount(next);

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    if (next >= 5) {
      setTapCount(0);
      onAdminAccess();
      return;
    }

    tapTimerRef.current = setTimeout(() => setTapCount(0), 1500);
  };

  return (
    <>
    <header className="sticky top-0 z-40 bg-[#072b26] backdrop-blur-lg border-b border-[#1f6f63]">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-dark-border bg-dark-card text-neon-gold transition-all hover:border-neon-green/40 active:scale-95"
          >
            <Menu size={18} />
          </button>
          {/* Logo — secret 5-tap admin trigger */}
          <div
            onClick={handleLogoTap}
            className="flex items-center select-none cursor-default"
            role="presentation"
          >
            <img
              src="https://i.postimg.cc/Hs6mwS6P/Chat-GPT-Image-Sep-25-2026-02-40-49-PM.png"
              alt="24XBET"
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-dark-card border border-dark-border rounded-full px-3 py-1.5">
            <Wallet size={16} className="text-neon-gold" />
            <span className="font-display font-bold text-sm text-neon-gold">
              ৳{bn(Math.floor(balance).toLocaleString('en-US'))}
            </span>
          </div>
          <button
            onClick={onDeposit}
            className="flex items-center gap-1 bg-neon-green text-dark-bg font-bold text-sm px-3.5 py-1.5 rounded-full hover:bg-neon-green/90 transition-all active:scale-95 neon-green-glow"
          >
            <Plus size={16} strokeWidth={3} />
            {t('header.deposit')}
          </button>
        </div>
      </div>
    </header>
    <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onNavigate={onNavigate} />
    </>
  );
}
