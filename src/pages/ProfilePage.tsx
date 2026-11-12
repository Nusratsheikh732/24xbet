import { useState, useEffect } from 'react';
import {
  Wallet, Banknote, ArrowDownToLine, Activity, Receipt, History, User, ShieldCheck,
  UserPlus, Gift, Percent, Mail, MessageSquare, Download, Headset, LogOut, Trophy,
  Copy, Check, TrendingUp, Info, Camera,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNotifications } from '@/context/NotificationContext';
import { db, ref, onValue } from '@/lib/firebase';
import MyPredictionsModal from '@/components/MyPredictionsModal';
import TransactionHistoryModal from '@/components/TransactionHistoryModal';
import NotificationsModal from '@/components/NotificationsModal';
import SecurityModal from '@/components/SecurityModal';
import HelpSupportModal from '@/components/HelpSupportModal';
import AboutMyInfoModal from '@/components/AboutMyInfoModal';
import AvatarPickerModal from '@/components/AvatarPickerModal';
import type { Page, Prediction } from '@/types';

interface ProfilePageProps {
  balance: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onNavigate: (page: Page) => void;
  predictions: Prediction[];
}

type ModalType = 'predictions' | 'transactions' | 'notifications' | 'security' | 'help' | 'about' | 'avatar' | null;

interface MemberTile {
  key: string;
  label: string;
  icon: typeof Trophy;
  onClick?: () => void;
  badge?: number;
}

export default function ProfilePage({ balance, onDeposit, onWithdraw, onNavigate, predictions }: ProfilePageProps) {
  const { user, logout, setAvatar } = useAuth();
  const { t, bn } = useLanguage();
  const { unreadCount } = useNotifications();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [turnoverTarget, setTurnoverTarget] = useState(100);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, 'game_settings/turnover'), (snap) => {
      if (snap.exists()) {
        setTurnoverTarget(snap.val().target ?? 100);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const effectiveTarget = user?.turnoverTarget != null ? user.turnoverTarget : turnoverTarget;

  const turnover = user?.turnover ?? 0;
  const turnoverPercent = Math.min(100, Math.round((turnover / effectiveTarget) * 100));
  const remaining = Math.max(0, effectiveTarget - turnover);
  const isComplete = turnover >= effectiveTarget;

  const turnoverMsg = isComplete
    ? t('profile.turnoverComplete')
    : t('profile.turnoverPlayMore').replace('{amount}', remaining.toLocaleString('en-US'));

  const joinedDate = user?.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : '';

  const handleCopyId = async () => {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const memberTiles: MemberTile[] = [
    { key: 'rewards', label: 'My Rewards', icon: Trophy, onClick: () => onNavigate('reward') },
    { key: 'bets', label: 'Bet History', icon: Activity, onClick: () => setActiveModal('predictions'), badge: predictions.length },
    { key: 'pnl', label: 'Profit And Loss', icon: Receipt },
    { key: 'deposits', label: 'Deposit Record', icon: ArrowDownToLine, onClick: () => setActiveModal('transactions') },
    { key: 'withdrawals', label: 'Withdrawal Record', icon: Banknote, onClick: () => setActiveModal('transactions') },
    { key: 'transactions', label: 'Transaction History', icon: History, onClick: () => setActiveModal('transactions') },
    { key: 'account', label: 'My Account', icon: User, onClick: () => setActiveModal('about') },
    { key: 'security', label: 'Security Center', icon: ShieldCheck, onClick: () => setActiveModal('security') },
    { key: 'invite', label: 'Invite Friends', icon: UserPlus, onClick: () => onNavigate('refer') },
    { key: 'mission', label: 'Mission', icon: Gift, onClick: () => onNavigate('mission') },
    { key: 'rebate', label: 'Rebate', icon: Percent },
    { key: 'messages', label: 'Internal Message', icon: Mail, onClick: () => setActiveModal('notifications'), badge: unreadCount },
    { key: 'suggestion', label: 'Suggestion', icon: MessageSquare, onClick: () => setActiveModal('help') },
    { key: 'download', label: 'Download APP', icon: Download },
    { key: 'service', label: 'Customer Service', icon: Headset, onClick: () => setActiveModal('help') },
    { key: 'logout', label: 'Logout', icon: LogOut, onClick: logout },
  ];

  return (
    <div className="-mx-2.5 min-h-full bg-[#f4f4f6] text-[#1d1d1f] -mt-2">
      <div className="bg-[#2a2320] px-4 py-3 text-center">
        <h1 className="font-display text-base font-bold text-white">My Account</h1>
      </div>

      <div className="space-y-4 p-3">
        <div className="rounded-2xl border border-white/70 bg-gradient-to-br from-white via-[#eef0f5] to-[#dfe3ec] p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <button
              onClick={() => setActiveModal('avatar')}
              className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border-2 border-white shadow active:scale-95 transition-transform"
              aria-label="Change avatar"
            >
              <img
                src={user?.avatar || 'https://i.postimg.cc/QdxBWFWD/IMG-20260926-045036.jpg'}
                alt="Profile"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#c8972f]">
                <Camera size={10} className="text-white" />
              </span>
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-base font-bold text-[#1d1d1f]">{user?.name || 'User'}</p>
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs text-[#555]">ID: {user?.uid ?? '-'}</span>
                <button
                  onClick={handleCopyId}
                  className="shrink-0 text-[#555] transition-colors hover:text-[#1d1d1f]"
                  aria-label="Copy ID"
                >
                  {copied ? <Check size={14} className="text-[#2e8b57]" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="truncate text-xs text-[#555]">Nickname: {user?.name || '-'}</p>
              {joinedDate && <p className="text-xs text-[#555]">Joined: {joinedDate}</p>}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Wallet size={18} className="text-[#c8972f]" />
              <span className="font-display text-xl font-bold text-[#1d1d1f]">
                ৳{bn(balance.toLocaleString('en-US', { minimumFractionDigits: 2 }))}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              onClick={onDeposit}
              className="rounded-full border border-[#d6d9e2] bg-white py-2.5 text-sm font-semibold text-[#1d1d1f] shadow-sm transition-all active:scale-95"
            >
              Deposit
            </button>
            <button
              onClick={onWithdraw}
              className="rounded-full border border-[#d6d9e2] bg-white py-2.5 text-sm font-semibold text-[#1d1d1f] shadow-sm transition-all active:scale-95"
            >
              Withdrawal
            </button>
            <button
              disabled
              className="cursor-not-allowed rounded-full border border-[#d6d9e2] bg-white/60 py-2.5 text-sm font-semibold text-[#777] shadow-sm"
            >
              Bank Account
            </button>
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-full bg-[#e3e5ea] px-3 py-1 text-xs font-semibold text-[#333]">Member Center</span>
            <span className="h-px flex-1 bg-[#e0e2e8]" />
          </div>

          <div className="grid grid-cols-4 gap-x-2 gap-y-5">
            {memberTiles.map((tile) => {
              const Icon = tile.icon;
              const interactive = Boolean(tile.onClick);
              return (
                <button
                  key={tile.key}
                  onClick={tile.onClick}
                  disabled={!interactive}
                  className={`flex flex-col items-center gap-2 transition-transform ${
                    interactive ? 'active:scale-95' : 'cursor-default opacity-60'
                  }`}
                >
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#fbeed2] shadow-sm">
                    <Icon size={24} strokeWidth={1.75} className="text-[#b8862b]" />
                    {tile.badge !== undefined && tile.badge > 0 && (
                      <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-[#e53935] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                        {tile.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-center text-[12px] leading-tight text-[#333]">{tile.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#e4e4ea] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#2e8b57]" />
            <h3 className="font-display text-base font-bold text-[#1d1d1f]">{t('profile.turnover')}</h3>
          </div>

          <p className="text-xs font-medium leading-relaxed text-[#555]">{turnoverMsg}</p>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#777]">
              {t('profile.turnoverProgress')}
            </span>
            <span className={`font-display text-sm font-bold ${isComplete ? 'text-[#2e8b57]' : 'text-[#b8862b]'}`}>
              {turnoverPercent}%
            </span>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full border border-[#e4e4ea] bg-[#f0f1f5]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-[#2e8b57]' : 'bg-gradient-to-r from-[#c8972f] to-[#2e8b57]'}`}
              style={{ width: `${turnoverPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#777]">
              <span className="font-bold text-[#1d1d1f]">৳{bn(turnover.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))}</span>
              {' '}/{' '}
              <span>৳{bn(effectiveTarget.toLocaleString('en-US'))}</span>
            </span>
            {isComplete && (
              <span className="flex items-center gap-1 font-bold text-[#2e8b57]">
                <TrendingUp size={12} /> Done
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 pb-2 pt-2">
          <img
            src="https://i.postimg.cc/Hs6mwS6P/Chat-GPT-Image-Sep-25-2026-02-40-49-PM.png"
            alt="24XBET"
            className="h-8 w-8 rounded-full object-cover"
          />
          <p className="flex items-center gap-1 text-center text-[10px] text-[#777]">
            <Info size={10} /> 24xbet v1.0.0
          </p>
        </div>
      </div>

      <MyPredictionsModal
        isOpen={activeModal === 'predictions'}
        onClose={() => setActiveModal(null)}
        predictions={predictions}
      />
      <TransactionHistoryModal
        isOpen={activeModal === 'transactions'}
        onClose={() => setActiveModal(null)}
      />
      <NotificationsModal
        isOpen={activeModal === 'notifications'}
        onClose={() => setActiveModal(null)}
      />
      <SecurityModal
        isOpen={activeModal === 'security'}
        onClose={() => setActiveModal(null)}
      />
      <HelpSupportModal
        isOpen={activeModal === 'help'}
        onClose={() => setActiveModal(null)}
      />
      <AboutMyInfoModal
        isOpen={activeModal === 'about'}
        onClose={() => setActiveModal(null)}
      />
      <AvatarPickerModal
        isOpen={activeModal === 'avatar'}
        onClose={() => setActiveModal(null)}
        currentAvatar={user?.avatar || ''}
        excludeUid={user?.uid}
        onSelect={setAvatar}
      />
    </div>
  );
}
