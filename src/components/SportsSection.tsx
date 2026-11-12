import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import SportsHistoryModal from '@/components/SportsHistoryModal';
import FootballSection from '@/components/FootballSection';
import CricketSection from '@/components/CricketSection';
import { useLanguage } from '@/context/LanguageContext';
import type { Prediction } from '@/types';

interface SportsSectionProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  predictions: Prediction[];
  onAddPrediction: (p: Prediction) => void;
}

type SportView = 'menu' | 'football' | 'cricket';

const FOOTBALL_LOGO = 'https://i.postimg.cc/L52PnJPn/images-(15).jpg';
const CRICKET_LOGO = 'https://i.postimg.cc/9QMGdwn0/images-(16).jpg';

export default function SportsSection({
  balance,
  onBetPlaced,
  predictions,
  onAddPrediction,
}: SportsSectionProps) {
  const { t } = useLanguage();
  const [view, setView] = useState<SportView>('menu');
  const [showHistory, setShowHistory] = useState(false);

  if (view === 'football') {
    return (
      <div>
        <button
          onClick={() => setView('menu')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <FootballSection
          balance={balance}
          onBetPlaced={onBetPlaced}
          predictions={predictions}
          onAddPrediction={onAddPrediction}
          onOpenHistory={() => setShowHistory(true)}
        />
        {showHistory && <SportsHistoryModal predictions={predictions} onClose={() => setShowHistory(false)} />}
      </div>
    );
  }

  if (view === 'cricket') {
    return (
      <div>
        <button
          onClick={() => setView('menu')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <CricketSection
          balance={balance}
          onBetPlaced={onBetPlaced}
          predictions={predictions}
          onAddPrediction={onAddPrediction}
          onOpenHistory={() => setShowHistory(true)}
        />
        {showHistory && <SportsHistoryModal predictions={predictions} onClose={() => setShowHistory(false)} />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white ring-1 ring-neon-green/50 shrink-0">
          <img src="/sports-logo.png" alt="Sports" className="w-full h-full object-cover" />
        </div>
        <h2 className="font-display text-lg font-bold text-white">{t('nav.sports')}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Football box */}
        <button
          onClick={() => setView('football')}
          className="relative group overflow-hidden rounded-2xl border border-neon-green/30 active:scale-95 transition-transform aspect-square"
        >
          <img
            src={FOOTBALL_LOGO}
            alt="Football"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <div className="absolute inset-0 flex flex-col items-center justify-end p-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/95 flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform">
              <img src={FOOTBALL_LOGO} alt="Football" className="w-full h-full object-cover" />
            </div>
            <p className="font-display text-base font-bold text-white drop-shadow-lg">{t('sports.football')}</p>
            <p className="text-[10px] text-gray-300 font-semibold mt-0.5">{t('sports.predictions')}</p>
          </div>
        </button>

        {/* Cricket box */}
        <button
          onClick={() => setView('cricket')}
          className="relative group overflow-hidden rounded-2xl border border-neon-blue/30 active:scale-95 transition-transform aspect-square"
        >
          <img
            src={CRICKET_LOGO}
            alt="Cricket"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <div className="absolute inset-0 flex flex-col items-center justify-end p-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/95 flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform">
              <img src={CRICKET_LOGO} alt="Cricket" className="w-full h-full object-cover" />
            </div>
            <p className="font-display text-base font-bold text-white drop-shadow-lg">{t('sports.cricket')}</p>
            <p className="text-[10px] text-gray-300 font-semibold mt-0.5">{t('sports.predictions')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
