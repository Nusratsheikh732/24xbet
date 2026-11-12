import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Menu, Wallet, Volume2, VolumeX } from 'lucide-react';
import SuperAceGame from '@/components/SuperAceGame';
import { useLanguage } from '@/context/LanguageContext';

const LOADING_IMAGE = 'https://i.postimg.cc/nzqM6ZdM/1791583696258.jpg';
const LOADING_DURATION = 2500;
const BG_MUSIC_SRC = '/super-ace-bg.mp3';

interface SuperAcePageProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  onBack: () => void;
}

export default function SuperAcePage({ balance, onBetPlaced, onWin, onBack }: SuperAcePageProps) {
  const { bn } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), LOADING_DURATION - 500);
    const doneTimer = setTimeout(() => setLoading(false), LOADING_DURATION);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  useEffect(() => {
    const audio = new Audio(BG_MUSIC_SRC);
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
  }, [muted]);

  return (
    <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col max-w-md mx-auto overflow-hidden">
      {loading && (
        <div
          className={`absolute inset-0 z-[60] flex items-center justify-center transition-opacity duration-500 ${
            fadeOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <img
            src={LOADING_IMAGE}
            alt="Loading Super Ace"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-4 border-neon-gold/30 border-t-neon-gold animate-spin mb-4" />
            <p className="text-neon-gold font-display text-lg font-bold tracking-wide animate-pulse-soft">
              Loading Super Ace
            </p>
          </div>
        </div>
      )}

      <header className="shrink-0 bg-dark-card/95 backdrop-blur-sm border-b border-dark-border h-14 flex items-center justify-between px-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-transform"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-neon-gold/30 flex items-center justify-center shrink-0 bg-gradient-to-br from-neon-gold/20 to-dark-card2">
            <img
              src="https://i.postimg.cc/7PcqLhRB/images-(5).jpg"
              alt="Super Ace"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold text-white leading-none">Super Ace</h1>
            <p className="text-[10px] text-neon-gold font-bold uppercase leading-none mt-0.5">Card Slot</p>
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
          <button
            onClick={() => setMuted((m) => !m)}
            className="w-8 h-8 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-transform"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button className="w-8 h-8 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
            <Menu size={16} />
          </button>
        </div>
      </header>

      <SuperAceGame
        balance={balance}
        onBetPlaced={onBetPlaced}
        onWin={onWin}
        loaded={!loading}
      />
    </div>
  );
}
