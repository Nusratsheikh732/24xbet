import { useState } from 'react';
import { ChevronLeft, Check, Flag, Inbox } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NEW_MEMBER_MISSION } from '@/data/missions';

interface MissionPageProps {
  balance: number;
  onBack: () => void;
}

type MissionTab = 'in-progress' | 'coming-soon' | 'finished';

const TABS: { id: MissionTab; label: string }[] = [
  { id: 'in-progress', label: 'In Progress' },
  { id: 'coming-soon', label: 'Coming soon' },
  { id: 'finished', label: 'Finished' },
];

const formatAmount = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MissionPage({ balance, onBack }: MissionPageProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<MissionTab>('in-progress');

  const turnover = user?.turnover ?? 0;
  const displayId = user?.name || user?.email || user?.uid || '';

  const milestones = NEW_MEMBER_MISSION.milestones.map((m) => ({
    ...m,
    done: turnover >= m.target,
    progress: Math.min(turnover, m.target),
  }));
  const completedCount = milestones.filter((m) => m.done).length;
  const percent = Math.round((completedCount / milestones.length) * 100);

  const visibleMilestones =
    tab === 'in-progress' ? milestones.filter((m) => !m.done) : tab === 'finished' ? milestones.filter((m) => m.done) : [];

  return (
    <div className="-mx-2.5 -mt-2 min-h-full bg-[#f3f3f7] pb-8 text-gray-800">
      <div className="relative flex items-center justify-center bg-[#0f4f4a] px-4 py-3.5">
        <button
          onClick={onBack}
          aria-label="Back"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-300 transition-transform active:scale-90"
        >
          <ChevronLeft size={26} />
        </button>
        <h1 className="font-display text-base font-bold text-amber-300">Mission</h1>
      </div>

      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-500 via-sky-600 to-teal-500 px-4 pb-14 pt-4">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15" />
        <div className="relative flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white/80 bg-white">
            {user?.avatar && <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{displayId}</p>
            <p className="font-display text-2xl font-bold text-white">৳ {formatAmount(balance)}</p>
          </div>
        </div>
      </div>

      <div className="-mt-10 px-3">
        <div className="flex rounded-xl bg-white/95 p-1 shadow-md">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  active ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-4 px-3">
        {tab === 'coming-soon' && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-8 text-center shadow-sm">
            <Inbox size={32} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">No upcoming missions yet</p>
            <p className="text-xs text-gray-500">New missions will appear here.</p>
          </div>
        )}

        {tab === 'in-progress' && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-gray-900">{NEW_MEMBER_MISSION.title}</p>
              <span className="font-display text-lg font-bold text-gray-900">{percent}%</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Milestones: {completedCount}/{milestones.length}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {tab !== 'coming-soon' && (
          <>
            {visibleMilestones.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
                {tab === 'finished' ? 'No finished milestones yet.' : 'All milestones are complete.'}
              </div>
            ) : (
              visibleMilestones.map((m, index) => (
                <div key={m.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow ${
                        m.done ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
                    >
                      {m.done ? <Check size={18} /> : <Flag size={16} />}
                    </span>
                    {index < visibleMilestones.length - 1 && <span className="mt-1 w-px flex-1 bg-gray-300" />}
                  </div>
                  <div className="flex-1 rounded-xl bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-700">
                      <span>Valid bet:</span>
                      <span className="whitespace-nowrap">
                        ৳ {formatAmount(m.progress)} / {formatAmount(m.target)}
                      </span>
                    </div>
                    <div className="my-3 h-px bg-gray-200" />
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                      <span className="rounded-full bg-pink-100 px-3 py-1 text-pink-600">
                        {m.rewardName} : {m.rewardCount}
                      </span>
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-600">
                        Bonus : ৳ {formatAmount(m.bonus)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
