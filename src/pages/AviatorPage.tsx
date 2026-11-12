import { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, Wrench, Clock, Volume2, VolumeX } from 'lucide-react';
import AviatorGame from '@/components/AviatorGame';
import { useLanguage } from '@/context/LanguageContext';
import { db, ref, onValue } from '@/lib/firebase';

interface AviatorPageProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  onBack: () => void;
}

export default function AviatorPage({ balance, onBetPlaced, onWin, onBack }: AviatorPageProps) {
  const { t, bn } = useLanguage();
  const [gameActive, setGameActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, 'game_settings/aviator'), (snap) => {
      if (snap.exists()) {
        setGameActive(snap.val().active ?? true);
      } else {
        setGameActive(true);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col max-w-md mx-auto overflow-y-auto touch-pan-y">
      {/* Professional header: logo left, balance + menu right */}
      <header className="shrink-0 bg-dark-card/95 backdrop-blur-sm border-b border-dark-border h-14 flex items-center justify-between px-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-transform"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-neon-red/50 flex items-center justify-center shrink-0 bg-black/40">
            <img src="/aviator-logo.png" alt="Aviator" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-lg font-bold text-white leading-none tracking-wide">
            {t('nav.aviator')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-dark-card2 border border-dark-border rounded-lg px-2.5 py-1.5">
            <Wallet size={14} className="text-neon-green" />
            <span className="text-sm font-bold text-white tabular-nums leading-none">
              {bn(balance.toFixed(2))}
            </span>
            <span className="text-[10px] text-gray-500 font-semibold leading-none">BDT</span>
          </div>
          <button
            onClick={() => setIsMuted((previous) => !previous)}
            aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
            title={isMuted ? 'Turn sound on' : 'Turn sound off'}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center active:scale-90 transition-all ${isMuted ? 'bg-neon-red/10 border-neon-red/30 text-neon-red' : 'bg-dark-card2 border-dark-border text-neon-green'}`}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </header>

      {/* Maintenance screen when game is OFF */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full border-2 border-dark-border border-t-neon-green animate-spin" />
            <p className="text-sm text-gray-500 font-semibold">Loading...</p>
          </div>
        </div>
      ) : !gameActive ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-neon-red/10 border border-neon-red/30 flex items-center justify-center mb-5">
            <Wrench size={36} className="text-neon-red" />
          </div>
          <h2 className="font-display text-2xl font-bold text-white mb-2">Aviator Under Maintenance</h2>
          <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
            The Aviator game is temporarily closed for maintenance. Please check back later.
          </p>
          <div className="flex items-center gap-2 bg-dark-card2 border border-dark-border rounded-lg px-4 py-2.5 mb-6">
            <Clock size={14} className="text-neon-gold" />
            <span className="text-xs text-gray-400 font-semibold">We'll be back soon</span>
          </div>
          <button
            onClick={onBack}
            className="bg-dark-card2 border border-dark-border text-gray-300 font-bold text-sm px-6 py-3 rounded-xl active:scale-95 transition-all flex items-center gap-2 hover:bg-dark-border"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>
        </div>
      ) : (
        <AviatorGame
          balance={balance}
          onBetPlaced={onBetPlaced}
          onWin={onWin}
          isMuted={isMuted}
          fullscreen
        />
      )}
    </div>
  );
}
