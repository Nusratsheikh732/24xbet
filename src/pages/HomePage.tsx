import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Gift, ChevronLeft, ChevronRight, Megaphone, Flame, Heart, Cherry, Target, Trophy, Plane, Fish, Spade, Layers, type LucideIcon } from 'lucide-react';
import { TradingCard } from '@/TradingDemo';
import { SpinWheelCard } from '@/SpinWheelGame';
import { db, ref, onValue } from '@/lib/firebase';
import { openModal, closeModal } from '@/hooks/useModalState';
import SportsSection from '@/components/SportsSection';
import { useLanguage } from '@/context/LanguageContext';
import type { Prediction } from '@/types';
import WelcomePopup from '@/components/WelcomePopup';

interface Banner {
  id: string;
  url: string;
  order: number;
  link?: string;
}

const DEFAULT_BANNER_1_LINK = 'https://appsgeyser.io/20222339/24xbet';

const DEFAULT_BANNER =
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180"><rect width="400" height="180" fill="#1a1a2e"/></svg>'
  );

const ANNOUNCEMENT = 'Welcome to 24XBET. Play responsibly and enjoy the games.';

interface HomePageProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  predictions: Prediction[];
  onAddPrediction: (p: Prediction) => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onOpenAviator: () => void;
  onOpenSuperAce: () => void;
  onOpenRoulette: () => void;
  onOpenLiveRoulette: () => void;
  onOpenSlots: () => void;
  onOpenWildFrontier: () => void;
  onOpenSuperElements: () => void;
  onOpenFlyX: () => void;
  onOpenLudo: () => void;
  onOpenTrading: () => void;
  onOpenSpinWheel: () => void;
  onOpenPredictionMarket: () => void;
  onOpenWildBounty: () => void;
  onOpenSevenUp: () => void;
  onOpenCrazyTime: () => void;
  onOpenCoinToss: () => void;
}

export default function HomePage({
  balance,
  onBetPlaced,
  onWin,
  predictions,
  onAddPrediction,
  isAuthenticated,
  onRequireAuth,
  onDeposit,
  onWithdraw,
  onOpenAviator,
  onOpenSuperAce,
  onOpenRoulette,
  onOpenLiveRoulette,
  onOpenSlots,
  onOpenWildFrontier,
  onOpenSuperElements,
  onOpenFlyX,
  onOpenLudo,
  onOpenTrading,
  onOpenSpinWheel,
  onOpenPredictionMarket,
  onOpenWildBounty,
  onOpenSevenUp,
  onOpenCrazyTime,
  onOpenCoinToss,
}: HomePageProps) {
  const { t } = useLanguage();
  const [showFootball, setShowFootball] = useState(false);
  const hotGamesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFootball) return;
    openModal();
    window.history.pushState({ sportsModal: true }, '');
    const handlePopState = () => setShowFootball(false);
    window.addEventListener('popstate', handlePopState);
    return () => {
      closeModal();
      window.removeEventListener('popstate', handlePopState);
      const st = window.history.state as { sportsModal?: boolean } | null;
      if (st?.sportsModal) window.history.back();
    };
  }, [showFootball]);

  return (
    <div className="relative isolate min-h-full space-y-4 bg-gradient-to-b from-[#0d4a40] via-[#0a3b34] to-[#072b26] px-2.5 pb-6 pt-2">
      <WelcomePopup />

      <div className="flex items-center gap-2.5 rounded-full border border-[#1f6f63] bg-[#0b3f37]/80 px-3 py-1.5">
        <Megaphone size={16} className="shrink-0 text-amber-400" />
        <p className="truncate text-xs font-medium text-amber-100">{ANNOUNCEMENT}</p>
      </div>

      <BannerSlider />

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={onDeposit}
          aria-label="Deposit"
          className="block w-full transition-all hover:brightness-110 active:scale-95"
        >
          <img src="/assets/icons/IMG_20261111_205344.jpg" alt="Deposit" className="block h-auto w-full" />
        </button>
        <button
          onClick={onWithdraw}
          aria-label="Withdraw"
          className="block w-full transition-all hover:brightness-110 active:scale-95"
        >
          <img src="/assets/icons/IMG_20261111_205326.jpg" alt="Withdraw" className="block h-auto w-full" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => hotGamesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#1f6f63] bg-[#0b3f37] text-xs font-bold uppercase tracking-wide text-white transition-all active:scale-95"
        >
          <Flame size={16} className="text-orange-400" />
          Hot Games
        </button>
        <button
          disabled
          className="flex h-11 cursor-default items-center justify-center gap-1.5 rounded-xl border border-[#1f6f63]/60 bg-[#0b3f37]/60 text-xs font-bold uppercase tracking-wide text-gray-400"
        >
          <Heart size={16} className="text-teal-400/60" />
          Favorites
        </button>
        <button
          onClick={onOpenSlots}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#1f6f63] bg-[#0b3f37] text-xs font-bold uppercase tracking-wide text-white transition-all active:scale-95"
        >
          <Cherry size={16} className="text-teal-300" />
          Slots
        </button>
      </div>

      <div ref={hotGamesRef} className="animate-fade-in-up scroll-mt-4">
        <h2 className="mb-2.5 font-display text-lg font-extrabold uppercase tracking-wide text-[#5ef0c1]">
          {t('home.popular')}
        </h2>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { key: 'wildbounty', title: '', img: 'https://i.postimg.cc/t4F9xDQ8/Screenshot-2026-11-04-14-33-14-567-com-android-chrome-edit.jpg', onClick: onOpenWildBounty },
            { key: 'superace', title: 'Super Ace', img: 'https://i.postimg.cc/7PcqLhRB/images-(5).jpg', onClick: onOpenSuperAce },
            { key: 'roulette', title: t('nav.roulette'), img: 'https://i.postimg.cc/yxQ4bQ0s/images-(9).jpg', onClick: onOpenRoulette },
            { key: 'flyx', title: t('flyx.title'), img: 'https://i.postimg.cc/MT6LJ068/Screenshot-2026-09-26-00-45-42-603-com-android-chrome-edit.jpg', onClick: onOpenFlyX },
            { key: 'superelements', title: t('superElements.title'), img: 'https://i.postimg.cc/fbZ2Y70d/images-(5).jpg', onClick: onOpenSuperElements },
            { key: 'wildfrontier', title: 'Pg', img: '', onClick: onOpenWildFrontier },
            { key: 'slots', title: t('slots.title'), img: 'https://i.postimg.cc/hvh1vvnm/Chat-GPT-Image-Sep-27-2026-02-38-09-PM.png', onClick: onOpenSlots },
            { key: 'ludo', title: 'Ludo King', img: 'https://i.postimg.cc/3wcyR776/images-(11).jpg', onClick: onOpenLudo },
            { key: 'sevenup', title: '7 Up 7 Down', img: '/seven-up-seven-down/Screenshot_2026-11-11-19-28-26-189_com.android.chrome copy.jpg', onClick: onOpenSevenUp },
            { key: 'crazytime', title: 'Crazy Time', img: 'https://i.postimg.cc/9fb7gGjF/images.jpg', onClick: onOpenCrazyTime },
          ].map((game) => (
            <button
              key={game.key}
              onClick={game.onClick}
              className={`relative group active:scale-95 transition-transform ${
                game.key === 'wildfrontier' ? 'order-5' : game.key === 'superelements' ? 'order-7' : game.key === 'slots' ? 'order-6' : game.key === 'ludo' ? 'order-7' : 'order-1'
              }`}
            >
              <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-dark-card2 border border-dark-border group-hover:border-neon-green/30 transition-colors">
                {game.img ? (
                  <img
                    src={game.img}
                    alt={game.title}
                    loading="lazy"
                    className={`w-full h-full ${game.key === 'crazytime' ? 'object-contain bg-dark-card2' : 'object-cover'} opacity-70 group-hover:opacity-90 transition-opacity`}
                  />
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_25%,rgba(234,175,79,.35),transparent_38%),linear-gradient(145deg,#6f3a1d,#24130d_68%,#0c0908)]">
                    <div className="absolute inset-2 rounded-lg border border-[#e5b75d]/40" />
                  <div className="relative text-center"><p className="font-display text-sm font-black tracking-[.12em] text-[#ffe09a]">PG</p></div>

                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/40 to-transparent" />

                {/* Play overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-neon-green/90 flex items-center justify-center neon-green-glow">
                    <Play size={14} fill="currentColor" className="text-dark-bg" />
                  </div>
                </div>

                {/* Game name */}
                {game.title && (
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-[11px] font-bold text-white truncate leading-tight">{game.title}</p>
                </div>
                )}
              </div>
            </button>
          ))}

          <SpinWheelCard onClick={onOpenSpinWheel} className="order-4" />

          {/* Prediction Market card */}
          <button
            onClick={onOpenPredictionMarket}
            className="relative group active:scale-95 transition-transform order-8"
          >
            <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-dark-card2 border border-dark-border group-hover:border-neon-blue/30 transition-colors">
              <img
                src="https://i.postimg.cc/6q8dxbJW/Chat-GPT-Image-Oct-15-2026-02-53-03-AM.png"
                alt="Prediction Market"
                loading="lazy"
                className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/40 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-9 h-9 rounded-full bg-neon-blue/90 flex items-center justify-center" style={{ boxShadow: '0 0 12px rgba(0,212,255,0.5)' }}>
                  <Play size={14} fill="currentColor" className="text-dark-bg" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-[11px] font-bold text-white truncate leading-tight">Prediction Market</p>
              </div>
            </div>
          </button>

          {/* Trading card — full width, moved to bottom */}
          <button
            onClick={onOpenTrading}
            className="col-span-full relative group active:scale-95 transition-transform order-9"
          >
            <div className="relative w-full h-[110px] rounded-xl overflow-hidden bg-dark-card2 border border-dark-border group-hover:border-neon-green/30 transition-colors">
              <img
                src="https://i.postimg.cc/nr2pBT0x/images-(1)-(1).jpg"
                alt="Trading"
                loading="lazy"
                className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-dark-bg via-dark-bg/50 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-end pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-9 h-9 rounded-full bg-neon-green/90 flex items-center justify-center neon-green-glow">
                  <Play size={14} fill="currentColor" className="text-dark-bg" />
                </div>
              </div>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <p className="text-sm font-bold text-white">Trading</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="animate-fade-in-up">
        <h2 className="mb-2.5 font-display text-lg font-extrabold uppercase tracking-wide text-[#5ef0c1]">
          Games
        </h2>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { key: 'cricket', label: 'Cricket', icon: Target, gradient: 'from-emerald-500/30 to-green-700/30' },
            { key: 'football', label: 'Football', icon: Trophy, gradient: 'from-emerald-500/30 to-green-700/30' },
            { key: 'multileague', label: 'Multi League', icon: Layers, gradient: 'from-emerald-500/30 to-green-700/30' },
            { key: 'pilot', label: 'পাইলট', icon: Plane, gradient: 'from-emerald-500/30 to-green-700/30' },
            { key: 'roulette', label: '24x Live Roulette', img: '/assets/icons/Screenshot_2026-11-11-23-50-12-911_com.android.chrome-edit.jpg', gradient: 'from-emerald-500/30 to-green-700/30', onClick: onOpenLiveRoulette },
            { key: 'fishcatch', label: 'Fish Catch', icon: Fish, gradient: 'from-emerald-500/30 to-green-700/30' },
            { key: 'andarbahar', label: 'Andar Bahar', icon: Spade, gradient: 'from-emerald-500/30 to-green-700/30' },
            { key: 'cointoss', label: 'Coin Toss', img: '/assets/IMG_20261111_192917.jpg', gradient: 'from-emerald-500/30 to-green-700/30', onClick: onOpenCoinToss },
          ] as { key: string; label: string; icon?: LucideIcon; img?: string; gradient: string; onClick?: () => void }[]).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={item.onClick}
                className={`relative group active:scale-95 transition-transform`}
              >
                <div className={`relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br ${item.gradient} border border-[#1f6f63] group-hover:border-neon-green/40 transition-colors`}>
                  {item.img ? (
                    <img
                      src={item.img}
                      alt={item.label}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : Icon ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Icon size={26} strokeWidth={1.75} className="text-[#5ef0c1] group-hover:text-amber-300 transition-colors" />
                    </div>
                  ) : null}
                </div>
                <p className="mt-1 text-center text-[10px] font-semibold text-gray-200 truncate leading-tight">{item.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="animate-fade-in-up">
        <h2 className="mb-2.5 font-display text-lg font-extrabold uppercase tracking-wide text-[#5ef0c1]">
          Live & Sports
        </h2>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onOpenAviator}
            className="relative group overflow-hidden rounded-xl border border-neon-green/30 active:scale-95 transition-transform min-h-[130px]"
          >
            <img
              src="/aviator-logo.png"
              alt="Aviator"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
            <div className="relative h-full min-h-[130px] p-3 flex flex-col justify-end">
              <p className="font-display text-base font-bold text-white drop-shadow-lg">{t('nav.aviator')}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] text-white font-bold bg-neon-red px-2 py-0.5 rounded-full animate-pulse-soft">
                  LIVE
                </span>
                <span className="text-[9px] text-gray-300 font-semibold">Fly & cash out</span>
              </div>
            </div>
          </button>

          {/* Sports card */}
          <button
            onClick={() => {
              if (!isAuthenticated) {
                onRequireAuth();
                return;
              }
              setShowFootball(true);
            }}
            className="relative group overflow-hidden rounded-xl border border-dark-border active:scale-95 transition-transform hover:border-neon-green/30 min-h-[130px]"
          >
            <img
              src="/sports-logo.png"
              alt="Sports"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
            <div className="relative h-full min-h-[130px] p-3 flex flex-col justify-end">
              <p className="font-display text-base font-bold text-white drop-shadow-lg">{t('nav.sports')}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] text-neon-green font-bold bg-neon-green/20 px-2 py-0.5 rounded-full border border-neon-green/40">
                  {predictions.length > 0 ? `${predictions.length} active` : 'LIVE'}
                </span>
                <span className="text-[9px] text-gray-300 font-semibold">Football predictions</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Football section modal */}
      {showFootball && (
        <div
          className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setShowFootball(false)}
        >
          <div
            className="bg-dark-card w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-dark-border animate-fade-in-up max-h-[100vh] mb-0 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-card border-b border-dark-border px-4 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white ring-1 ring-neon-blue/50 shrink-0">
                  <img src="/sports-logo.png" alt="Sports" className="w-full h-full object-cover" />
                </div>
                <h3 className="font-display text-lg font-bold text-white">{t('nav.sports')}</h3>
              </div>
              <button
                onClick={() => setShowFootball(false)}
                className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <SportsSection
                balance={balance}
                onBetPlaced={onBetPlaced}
                predictions={predictions}
                onAddPrediction={onAddPrediction}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Dynamic Banner Slider ─────────────────────────────
function BannerSlider() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(db, 'game_settings/banners'), (snap) => {
      if (snap.exists()) {
        const list = ((snap.val().list as Banner[] | undefined) ?? []).slice().sort((a, b) => a.order - b.order);
        setBanners(list);
        setCurrentIdx((prev) => Math.min(prev, Math.max(0, list.length - 1)));
      } else {
        setBanners([]);
      }
    });
    return () => unsub();
  }, []);

  const goTo = useCallback((idx: number, len: number) => {
    if (len <= 0) return;
    setCurrentIdx(((idx % len) + len) % len);
  }, []);

  const handleManualNav = useCallback((target: number) => {
    goTo(target, banners.length);
    if (timerRef.current) clearInterval(timerRef.current);
    if (banners.length > 1 && !isPaused) {
      timerRef.current = setInterval(() => {
        setCurrentIdx((prev) => (prev + 1) % banners.length);
      }, 4000);
    }
  }, [banners.length, isPaused, goTo]);

  useEffect(() => {
    if (banners.length <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length, isPaused, currentIdx]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      handleManualNav(diff > 0 ? currentIdx + 1 : currentIdx - 1);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (banners.length === 0) {
    return (
      <div className="relative flex aspect-[12/5] w-full items-center justify-center overflow-hidden rounded-2xl border border-[#1f6f63] bg-gradient-to-br from-[#0f5a4d] via-[#0b4138] to-[#072b26]">
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="relative flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 ring-1 ring-amber-400/40">
            <Gift size={24} className="text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight text-amber-300">
              প্রথম ডিপোজিটে ২০০% পর্যন্ত বোনাস!
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-gray-300">
              Up to 200% bonus on your first deposit
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[12/5] w-full overflow-hidden rounded-2xl bg-[#0b3f37]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {banners.map((banner, idx) => (
        <div
          key={banner.id}
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: idx === currentIdx ? 1 : 0, zIndex: idx === currentIdx ? 2 : 1 }}
        >
          {(() => {
            const link = banner.link || (idx === 0 ? DEFAULT_BANNER_1_LINK : undefined);
            const img = (
              <img
                src={banner.url}
                alt={`Promo ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_BANNER;
                }}
              />
            );
            return link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="block w-full h-full cursor-pointer">
                {img}
              </a>
            ) : img;
          })()}
        </div>
      ))}

      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleManualNav(currentIdx - 1);
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors"
            aria-label="Previous banner"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleManualNav(currentIdx + 1);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors"
            aria-label="Next banner"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleManualNav(idx)}
              aria-label={`Show banner ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIdx
                  ? 'w-5 bg-white'
                  : 'w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
