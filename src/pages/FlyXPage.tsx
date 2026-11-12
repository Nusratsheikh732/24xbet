import { useState, useEffect } from 'react';
import { ArrowLeft, Menu, Wallet } from 'lucide-react';
import FlyXGame from '@/components/FlyXGame';
import { useLanguage } from '@/context/LanguageContext';

interface FlyXPageProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  onBack: () => void;
}

export default function FlyXPage({ balance, onBetPlaced, onWin, onBack }: FlyXPageProps) {
  const { t, bn } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const fadeTimer = setTimeout(() => setFadeOut(true), 2600);
    const doneTimer = setTimeout(() => setLoading(false), 3100);
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 100 / 31, 100));
    }, 90);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      clearInterval(progressInterval);
    };
  }, [loading]);

  if (loading) {
    return (
      <div
        className={`fixed inset-0 z-[100] overflow-hidden transition-opacity duration-500 ${
          fadeOut ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ background: '#0a0e17' }}
      >
        <img
          src="https://i.postimg.cc/t4z6Z4qM/MVIMG-20261002-004946.jpg"
          alt="FlyX"
          onLoad={() => setImgLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, transparent 55%, rgba(10,14,23,0.75) 82%, rgba(10,14,23,0.97) 100%)',
          }}
        />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-56">
          <div
            className="h-1.5 rounded-full bg-black/50 overflow-hidden"
            style={{ border: '1px solid rgba(255,51,102,0.3)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #ff3366, #ff9500)',
                boxShadow: '0 0 8px rgba(255,51,102,0.5)',
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span
              className="text-[10px] tracking-widest"
              style={{ fontFamily: 'Rajdhani, sans-serif', color: 'rgba(255,51,102,0.7)' }}
            >
              LOADING FLYX
            </span>
            <span
              className="text-[10px] tracking-widest"
              style={{ fontFamily: 'Rajdhani, sans-serif', color: 'rgba(255,51,102,0.7)' }}
            >
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-neon-red/50 flex items-center justify-center shrink-0 bg-gradient-to-br from-neon-red/20 to-dark-card2">
            <img
              src="https://i.postimg.cc/CKg8qpz1/images-(10).jpg"
              alt="FlyX"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <span className="font-display text-lg font-bold text-white leading-none tracking-wide block">
              {t('flyx.title')}
            </span>
            <span className="text-[10px] text-neon-red font-bold uppercase leading-none mt-0.5 block">
              {t('flyx.subtitle')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-dark-card2 border border-dark-border rounded-lg px-2.5 py-1.5">
            <Wallet size={14} className="text-neon-green" />
            <span className="text-sm font-bold text-white tabular-nums leading-none">
              {bn(balance.toFixed(2))}
            </span>
            <span className="text-[10px] text-gray-500 font-semibold leading-none">BDT</span>
          </div>
          <button className="w-8 h-8 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
            <Menu size={16} />
          </button>
        </div>
      </header>

      <FlyXGame
        balance={balance}
        onBetPlaced={onBetPlaced}
        onWin={onWin}
        fullscreen
      />
    </div>
  );
}
