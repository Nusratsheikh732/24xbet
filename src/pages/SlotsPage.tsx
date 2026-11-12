import { ArrowLeft, Menu, Wallet } from 'lucide-react';
import SlotMachineGame from '@/components/SlotMachineGame';
import SlotMachine24xbetGame from '@/components/SlotMachine24xbetGame';
import { useLanguage } from '@/context/LanguageContext';

interface SlotsPageProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  onBack: () => void;
  variant?: 'classic' | 'frontier';
}

export default function SlotsPage({ balance, onBetPlaced, onWin, onBack, variant = 'classic' }: SlotsPageProps) {
  const isFrontier = variant === 'frontier';
  const { t, bn } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col max-w-md mx-auto overflow-hidden">
      <header className="shrink-0 bg-dark-card/95 backdrop-blur-sm border-b border-dark-border h-14 flex items-center justify-between px-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-transform"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-neon-gold/30 flex items-center justify-center shrink-0 bg-dark-card2">
            <img
              src="https://i.postimg.cc/hvh1vvnm/Chat-GPT-Image-Sep-27-2026-02-38-09-PM.png"
              alt={isFrontier ? 'Wild Frontier' : 'Slot Machine'}
              className="w-full h-full object-contain"
              draggable={false}
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold text-white leading-none">{isFrontier ? 'Wild Frontier' : 'Slot Machine'}</h1>
            <p className="text-[10px] text-neon-gold font-bold uppercase leading-none mt-0.5">{t('slots.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-dark-card2 border border-dark-border rounded-lg px-2.5 py-1.5">
            <Wallet size={14} className="text-neon-green" />
            <span className="text-sm font-bold text-white tabular-nums leading-none">PLAY</span>
            <span className="text-[10px] text-neon-green font-semibold leading-none">DEMO</span>
          </div>
          <button className="w-8 h-8 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
            <Menu size={16} />
          </button>
        </div>
      </header>

      {isFrontier ? (
        <SlotMachineGame balance={balance} onBetPlaced={onBetPlaced} onWin={onWin} />
      ) : (
        <SlotMachine24xbetGame balance={balance} onBetPlaced={onBetPlaced} onWin={onWin} />
      )}
    </div>
  );
}
