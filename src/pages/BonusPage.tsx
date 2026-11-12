import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Crown, Ticket, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loadTransactions } from '@/lib/localStorage';

interface BonusPageProps {
  onBack: () => void;
  onDeposit: () => void;
}

const REQUIRED_DEPOSIT = 100;
const VOUCHER_EXPIRES_AT = new Date(2026, 10, 6, 23, 59, 59);

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { days, time: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function RewardsModal({
  deposited,
  claimed,
  onClaim,
  onDeposit,
  onClose,
}: {
  deposited: number;
  claimed: boolean;
  onClaim: () => void;
  onDeposit: () => void;
  onClose: () => void;
}) {
  const progress = Math.min(100, (deposited / REQUIRED_DEPOSIT) * 100);
  const ready = deposited >= REQUIRED_DEPOSIT;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="relative w-full max-w-[340px]">
        <div className="flex flex-col items-center">
          <div className="relative -mb-6 flex h-16 w-44 items-center justify-center rounded-md bg-gradient-to-r from-[#ff3b4b] to-[#ff6b5a] font-display text-2xl font-bold text-white shadow-lg">
            <Crown size={28} className="absolute -top-5 text-[#ffc400] drop-shadow" />
            Rewards
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-2 top-0 z-10 rounded-full border-2 border-white bg-black/40 p-1 text-white transition-transform active:scale-90"
        >
          <X size={20} />
        </button>

        <div className="rounded-2xl bg-[#0f3a57] px-5 pb-6 pt-8 text-center text-white shadow-2xl">
          <p className="text-base">Complete the task to claim your voucher</p>
          <div className="mt-4 h-6 overflow-hidden rounded-full border border-white/50 bg-black/30">
            <div
              className="flex h-full items-center justify-end bg-gradient-to-r from-[#ffc400] to-[#ff9e54] pr-2 text-xs font-semibold transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-sm font-semibold">{progress.toFixed(2)}%</p>

          <div className="mt-4 rounded-xl bg-white/15 p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                Amount to deposit - After claiming the voucher &ge; <span className="text-[#ffc400]">৳ {REQUIRED_DEPOSIT}</span>
              </p>
              <button
                onClick={onDeposit}
                className="shrink-0 rounded-full bg-gradient-to-b from-[#ffc83d] to-[#ff9e1b] px-4 py-2 text-sm font-semibold text-white shadow transition-transform active:scale-95"
              >
                Deposit
              </button>
            </div>
            <div className="mt-3 h-4 overflow-hidden rounded-full bg-black/40">
              <div className="h-full bg-[#ffc400] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span>{deposited}</span>
              <span>{REQUIRED_DEPOSIT}</span>
            </div>
          </div>

          {ready && !claimed && (
            <button
              onClick={onClaim}
              className="mt-5 w-full rounded-full bg-[#2fd11a] py-3 font-semibold text-white shadow-lg transition-transform active:scale-95"
            >
              Claim voucher
            </button>
          )}
          {claimed && <p className="mt-5 font-semibold text-[#7CFC00]">Voucher claimed</p>}
        </div>
      </div>
    </div>
  );
}

export default function BonusPage({ onBack, onDeposit }: BonusPageProps) {
  const { user } = useAuth();
  const now = useNow();
  const [showRewards, setShowRewards] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const displayId = user?.phone || user?.name || user?.uid || '';
  const deposited = useMemo(() => {
    const total = loadTransactions()
      .filter((t) => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    return Math.min(REQUIRED_DEPOSIT, total);
  }, [showRewards]);

  const countdown = formatCountdown(VOUCHER_EXPIRES_AT.getTime() - now);

  return (
    <div className="min-h-screen bg-[#f3f4f7] text-[#444]">
      <header className="sticky top-0 z-20 flex h-[64px] items-center justify-center bg-[#155d61] shadow-sm">
        <button onClick={onBack} aria-label="Back" className="absolute left-4 text-[#ffc400] active:scale-90">
          <ChevronLeft size={30} strokeWidth={2.5} />
        </button>
        <h1 className="font-display text-xl font-bold text-[#ffc400]">Bonus</h1>
        <Ticket size={26} className="absolute right-4 text-[#ffc400]" />
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-[#2fd5ff] to-[#0a6fe0] px-6 pb-10 pt-7 text-white">
        <div className="absolute -right-6 top-6 h-24 w-24 rounded-full bg-white/15" />
        <div className="absolute left-1/3 top-2 h-12 w-12 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-[#a8e4ff] bg-white/30">
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
                {(displayId || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{displayId}</p>
            <p className="mt-1 text-3xl font-bold">৳ 0.00</p>
          </div>
        </div>
      </section>

      <section className="mx-4 -mt-5 overflow-hidden rounded-2xl bg-white shadow-md">
        <div className="flex">
          <div className="flex w-[42%] shrink-0 flex-col items-center justify-center gap-1 bg-gradient-to-br from-[#ff3b4b] to-[#ff6b7a] p-4 text-center text-white">
            <span className="text-xs tracking-widest opacity-90">REWARD VOUCHER</span>
            <span className="text-base font-semibold leading-tight">Lucky Wheel</span>
            <span className="text-sm">2026.11.06</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
            <h2 className="text-base font-semibold text-[#333]">C - মেম্বারশিপ ডে মিশন টিকেট</h2>
            <p className="mt-1 text-sm text-[#666]">Reward : C - মেম্বারশিপ ডে মিশন টিকেট</p>
          </div>
          <div className="flex w-[28%] shrink-0 flex-col items-center justify-center gap-2 border-l border-dashed border-[#ddd] p-3">
            <p className="text-xs text-[#999]">Due Date</p>
            <p className="text-2xl font-bold text-[#444]">
              {countdown.days}
              <span className="text-sm font-normal">Day</span>
            </p>
            <p className="font-mono text-xs text-[#555]">{countdown.time}</p>
            <button
              onClick={() => setShowRewards(true)}
              disabled={claimed}
              className="w-full rounded-full bg-[#2fd11a] py-2 text-sm font-semibold text-white shadow transition-transform active:scale-95 disabled:bg-[#bbb]"
            >
              {claimed ? 'Claimed' : 'Claim'}
            </button>
          </div>
        </div>
      </section>

      {showRewards && (
        <RewardsModal
          deposited={deposited}
          claimed={claimed}
          onClaim={() => setClaimed(true)}
          onDeposit={() => {
            setShowRewards(false);
            onDeposit();
          }}
          onClose={() => setShowRewards(false)}
        />
      )}
    </div>
  );
}
