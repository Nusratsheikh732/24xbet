import { useState } from 'react';
import { ChevronLeft, CircleHelp, PiggyBank, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface RescueFundPageProps {
  onBack: () => void;
}

const GAME_TYPE = 'Fish';
const ACCUMULATED_NEGATIVE_PROFIT = 0;
const CLAIMABLE_AMOUNT = 0;

const TIERS = ['0.00', '0.00', '0.00', '0.00'];
const NET_LOSS_THRESHOLDS = ['\u22651.00', '\u226510,000.00', '\u226550,000.00', '\u2265100,000.00'];
const BONUS_RATIOS = ['3', '4', '5', '10'];

const REWARD_ROWS: { label: string; values: string[] }[] = [
  { label: 'Deposit Amounts', values: TIERS },
  { label: 'Net loss', values: NET_LOSS_THRESHOLDS },
  { label: 'Bonus Giving Ratio %', values: BONUS_RATIOS },
  { label: 'Points Giving Ratio %', values: ['', '', '', ''] },
  { label: 'Voucher', values: ['', '', '', ''] },
];

export default function RescueFundPage({ onBack }: RescueFundPageProps) {
  const { user } = useAuth();
  const [showHelp, setShowHelp] = useState(false);

  const displayId = user?.phone || user?.name || user?.uid || '';
  const balance = (user?.balance ?? 0).toFixed(2);
  const canClaim = CLAIMABLE_AMOUNT > 0;

  return (
    <div className="min-h-screen bg-[#f3f4f7] pb-10 text-[#444]">
      <header className="sticky top-0 z-20 flex h-[64px] items-center justify-center bg-[#155d61] shadow-sm">
        <button onClick={onBack} aria-label="Back" className="absolute left-4 text-[#ffc400] active:scale-90">
          <ChevronLeft size={30} strokeWidth={2.5} />
        </button>
        <h1 className="font-display text-xl font-bold text-[#ffc400]">Rescue fund</h1>
        <button
          onClick={() => setShowHelp((v) => !v)}
          aria-label="How it works"
          className="absolute right-4 text-[#ffc400] transition-transform active:scale-90"
        >
          <CircleHelp size={24} />
        </button>
      </header>

      {showHelp && (
        <div className="mx-4 mt-3 rounded-xl border border-[#ffc400]/40 bg-white p-3 text-sm text-[#555] shadow-sm animate-fade-in-up">
          Rescue fund returns a share of your net losses as a bonus. The higher your net loss in a cycle, the higher the ratio.
        </div>
      )}

      <section className="relative overflow-hidden bg-gradient-to-b from-[#9cd8ff] via-[#5aaeff] to-[#2f8ff0] px-4 pb-16 pt-6 text-white">
        <div className="absolute -right-8 top-4 h-28 w-28 rounded-full bg-white/20" />
        <div className="absolute left-6 top-24 h-14 w-14 rounded-full bg-white/15" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[#a8e4ff] bg-white/30">
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <User size={28} className="text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{displayId}</p>
            <p className="mt-1 text-2xl font-bold">৳ {balance}</p>
          </div>
        </div>
        <div className="relative mt-6 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/25 shadow-lg backdrop-blur-sm">
            <PiggyBank size={36} className="text-white" />
          </span>
        </div>
        <p className="relative mt-3 text-center text-sm opacity-90">Today</p>
      </section>

      <section className="-mt-10 mx-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-3 text-center shadow-md">
          <p className="text-sm font-semibold text-[#333]">Accumulated Negative Profit</p>
          <p className="mt-2 text-lg font-bold text-[#2563eb]">৳ {ACCUMULATED_NEGATIVE_PROFIT}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-md">
          <p className="text-sm font-semibold text-[#333]">Claimable Amount</p>
          <p className="mt-2 text-lg font-bold text-[#2563eb]">৳ {CLAIMABLE_AMOUNT}</p>
        </div>
      </section>

      <section className="mt-8 flex flex-col items-center px-4">
        <div className="relative flex h-44 w-44 items-center justify-center rounded-3xl bg-gradient-to-b from-[#7fb8f5] to-[#3f7fd6] shadow-[0_12px_30px_rgba(47,143,240,0.35)]">
          <div className="flex h-32 w-32 items-center justify-center rounded-2xl border-4 border-[#a8d4ff]/70 bg-[#4d8ee0]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#ffd34d] bg-[#2f6fc2]">
              <div className="h-4 w-4 rounded-full bg-[#ffd34d]" />
            </div>
          </div>
          <span className="absolute -right-2 top-8 h-3 w-5 rounded-sm bg-[#a8d4ff]" />
        </div>
        <button
          disabled={!canClaim}
          className="mt-4 w-56 rounded-full bg-gradient-to-b from-[#2fd11a] to-[#1fa50f] py-3 font-semibold text-white shadow-lg transition-transform enabled:active:scale-95 disabled:bg-gradient-to-b disabled:from-[#d6d6d6] disabled:to-[#b8b8b8] disabled:text-[#777] disabled:shadow-none"
        >
          Claim
        </button>
        {!canClaim && <p className="mt-2 text-xs text-[#777]">Nothing to claim yet</p>}
      </section>

      <section className="mt-8 px-4">
        <p className="text-center text-base text-[#333]">
          Game type: <span className="font-semibold">{GAME_TYPE}</span>
        </p>
        <p className="mt-4 text-sm font-semibold text-[#2563eb]">Reward Cycle</p>
        <div className="mt-2 overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full border-collapse text-center text-xs">
            <tbody>
              {REWARD_ROWS.map((row, i) => (
                <tr key={row.label} className={i > 0 ? 'border-t border-[#eee]' : ''}>
                  <th
                    scope="row"
                    className={`w-[28%] px-2 py-3 text-left font-semibold ${
                      i === 0 ? 'bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] text-white' : 'bg-[#eaf2ff] text-[#333]'
                    }`}
                  >
                    {row.label}
                  </th>
                  {row.values.map((v, j) => (
                    <td key={j} className="px-1 py-3 tabular-nums text-[#444]">
                      {v || '\u2014'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
