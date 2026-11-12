import { useState } from 'react';
import { ChevronLeft, ChevronRight, Gift, Users, CalendarCheck, LifeBuoy, Percent, Crown, Copy, Pencil, RefreshCw, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface PromotionPageProps {
  onBack: () => void;
  onOpenRefer: () => void;
  onOpenSignIn: () => void;
  onOpenBonus: () => void;
  onOpenRescue: () => void;
}

interface RewardTile {
  id: string;
  label: string;
  icon: typeof Gift;
  gradient: string;
  badge?: number;
}

const REWARD_TILES: RewardTile[] = [
  { id: 'bonus', label: 'Bonus', icon: Gift, gradient: 'from-emerald-400 to-green-600', badge: 1 },
  { id: 'sign-in', label: 'Sign In', icon: CalendarCheck, gradient: 'from-sky-400 to-blue-500' },
  { id: 'rescue', label: 'Rescue fund', icon: LifeBuoy, gradient: 'from-amber-300 to-yellow-400' },
  { id: 'invite', label: 'Invite Friends', icon: Users, gradient: 'from-rose-400 to-pink-600' },
  { id: 'promo', label: 'Promo Code', icon: Percent, gradient: 'from-cyan-400 to-sky-500' },
];

export default function PromotionPage({ onBack, onOpenRefer, onOpenSignIn, onOpenBonus, onOpenRescue }: PromotionPageProps) {
  const { user } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);

  const displayId = user?.phone || user?.name || user?.uid || '';
  const balance = (user?.balance ?? 0).toFixed(2);

  const handleTile = (tile: RewardTile) => {
    if (tile.id === 'invite') {
      onOpenRefer();
      return;
    }
    if (tile.id === 'sign-in') {
      onOpenSignIn();
      return;
    }
    if (tile.id === 'bonus') {
      onOpenBonus();
      return;
    }
    if (tile.id === 'rescue') {
      onOpenRescue();
      return;
    }
    setNotice(`${tile.label} is coming soon.`);
    window.setTimeout(() => setNotice(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="relative overflow-hidden bg-gradient-to-b from-orange-500 via-orange-400 to-orange-300 pb-24 pt-4">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/15" />
        <div className="pointer-events-none absolute -left-10 top-24 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-center px-4">
          <button
            onClick={onBack}
            aria-label="Back"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-200 transition-transform active:scale-90"
          >
            <ChevronLeft size={28} />
          </button>
          <h1 className="font-display text-xl font-bold text-yellow-300">My Rewards</h1>
        </div>
      </div>

      <div className="-mt-20 px-4">
        <div className="relative rounded-2xl border border-white/70 bg-slate-200/90 p-4 shadow-lg backdrop-blur-sm">
          <button
            onClick={onOpenSignIn}
            className="absolute right-0 top-0 flex items-center gap-2 rounded-bl-2xl rounded-tr-2xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-sm font-semibold text-white shadow transition-transform active:scale-95"
          >
            <CalendarCheck size={16} />
            <span>Sign In</span>
            <ChevronRight size={16} />
          </button>

          <div className="mt-8 flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-amber-400 bg-white">
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User size={36} className="m-auto mt-5 text-gray-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-bold text-gray-900">{displayId}</p>
                <Copy size={16} className="shrink-0 text-gray-800" />
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                <span className="truncate">Nickname: {displayId}</span>
                <Pencil size={14} className="shrink-0" />
              </div>
              <div className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
                <span>৳ {balance}</span>
                <RefreshCw size={20} className="text-gray-700" />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span className="flex items-center gap-1 font-semibold text-gray-700">
              <Crown size={16} />
              VIP0
            </span>
            <span className="flex items-center gap-1 font-medium">
              Benefits <ChevronRight size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 rounded-full bg-gray-300">
              <div className="h-1.5 w-0 rounded-full bg-amber-400" />
            </div>
            <span className="text-sm text-gray-600">0 / 1</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 px-4">
        {REWARD_TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              onClick={() => handleTile(tile)}
              className={`relative flex aspect-[4/3] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br ${tile.gradient} text-white shadow-md transition-transform duration-200 hover:-translate-y-0.5 active:scale-95`}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow">
                <Icon size={26} className="text-gray-700" />
              </span>
              <span className="text-base font-medium drop-shadow">{tile.label}</span>
              {tile.badge !== undefined && (
                <span className="absolute right-1/4 top-4 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white shadow">
                  {tile.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}
