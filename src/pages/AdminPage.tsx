import { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db, ref, get, set, push, update, onValue } from '@/lib/firebase';
import { onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { requestAdminToken } from '@/lib/adminLogin';
import { sendCustomNotification } from '@/lib/notifications';
import SportsManagementTab from '@/components/admin/SportsManagementTab';
import GameManagementTab from '@/components/admin/GameManagementTab';
import FlyXControlTab from '@/components/admin/FlyXControlTab';
import SuperElementsControlTab from '@/components/admin/SuperElementsControlTab';
import RouletteControlTab from '@/components/admin/RouletteControlTab';
import SlotMachineControlTab from '@/components/admin/SlotMachineControlTab';
import BannerControlTab from '@/components/admin/BannerControlTab';
import AviatorControlTab from '@/components/admin/AviatorControlTab';
import WelcomePopupControlTab from '@/components/admin/WelcomePopupControlTab';
import AirdropFeedbackTab from '@/components/admin/AirdropFeedbackTab';
import SpinWheelControlTab from '@/components/admin/SpinWheelControlTab';
import PredictionMarketControlTab from '@/components/admin/PredictionMarketControlTab';
import LudoControlTab from '@/components/admin/LudoControlTab';

import { Shield, Users, ArrowDownCircle, ArrowUpCircle, Settings, Check, X, Search, Lock, ChevronLeft, Plane, TrendingUp, AlertCircle, MessageCircle, MessageSquare, Spade, BarChart3, ToggleLeft, ToggleRight, Zap, Trophy, Link2, CreditCard, Gamepad2, Disc, Dice5, Flame, Send, Headphones, ChevronRight, Image, Sparkles, Bell, Percent, LogOut } from 'lucide-react';

interface AdminPageProps {
  onBack: () => void;
}

type AdminTab = 'users' | 'deposits' | 'withdraws' | 'crash' | 'superace' | 'flyx' | 'superelements' | 'roulette' | 'slots' | 'spinwheel' | 'predictionmarket' | 'ludo' | 'rtp' | 'sports' | 'games' | 'banners' | 'welcomepopup' | 'turnover' | 'referral' | 'support' | 'payment' | 'airdrop';

interface AdminUser {
  id: string;
  email: string;
  password: string;
  name: string;
  phone: string;
  balance: number;
  status: string;
  approved: boolean;
  createdAt: number;
  turnover: number;
  turnoverTarget: number | null;
}

interface AdminDeposit {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  method: string;
  amount: number;
  status: string;
  senderNumber: string;
  trxId: string;
  createdAt: number;
}

interface AdminWithdraw {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  method: string;
  amount: number;
  accountNumber: string;
  status: string;
  createdAt: number;
}

interface AdminSupportMessage {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  message: string;
  status: string;
  createdAt: number;
}

async function isAdminUid(uid: string): Promise<boolean> {
  const snap = await get(ref(db, `admins/${uid}`));
  return snap.val() === true;
}

export default function AdminPage({ onBack }: AdminPageProps) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<AdminTab>('users');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthed(false);
        setChecking(false);
        return;
      }
      try {
        const isAdmin = await isAdminUid(user.uid);
        console.info('[admin-auth] session check', { isAdmin });
        setAuthed(isAdmin);
      } catch (err) {
        console.error('[admin-auth] admin record check failed', (err as { code?: string })?.code ?? 'unknown');
        setAuthed(false);
      }
      setChecking(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    if (!password) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await requestAdminToken(password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const cred = await signInWithCustomToken(auth, result.token);
      const isAdmin = await isAdminUid(cred.user.uid);
      console.info('[admin-auth] custom token sign-in', { isAdmin });
      if (isAdmin) {
        setAuthed(true);
      } else {
        await signOut(auth);
        setError('This account does not have admin access.');
      }
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : 'unknown';
      console.error('[admin-login] Firebase sign-in failed', code);
      setError(`Firebase sign-in failed (${code}). Please try again.`);
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  };

  if (checking) {
    return (
      <div className="px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-gray-500">Checking admin access...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="px-4 py-8 flex flex-col items-center min-h-[60vh] justify-center">
        <div className="w-20 h-20 rounded-2xl bg-neon-green/10 flex items-center justify-center mb-4 neon-green-glow">
          <Lock size={36} className="text-neon-green" />
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-1">Admin Panel</h2>
        <p className="text-xs text-gray-500 mb-6">Enter the admin password</p>

        <div className="w-full max-w-sm space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            autoComplete="current-password"
            disabled={submitting}
            className="w-full bg-dark-card2 border border-dark-border rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-neon-green/40 text-sm"
          />
          {error && (
            <p className="text-xs text-neon-red flex items-center gap-1.5">
              <AlertCircle size={14} /> {error}
            </p>
          )}
          <button
            onClick={handleLogin}
            disabled={submitting}
            className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 neon-green-glow flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Shield size={18} strokeWidth={2.5} />
            Access Dashboard
          </button>
          <button
            onClick={onBack}
            className="w-full text-gray-500 text-sm font-semibold py-2 hover:text-white transition-colors"
          >
            Back to app
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'deposits', label: 'Deposits', icon: ArrowDownCircle },
    { id: 'withdraws', label: 'Withdraws', icon: ArrowUpCircle },
    { id: 'crash', label: 'Crash Control', icon: Plane },
    { id: 'superace', label: 'Super Ace', icon: Spade },
    { id: 'flyx', label: 'FlyX', icon: Plane },
    { id: 'superelements', label: 'Super Elements', icon: Flame },
    { id: 'roulette', label: 'Roulette', icon: Disc },
    { id: 'slots', label: 'Slot Machine', icon: Gamepad2 },
    { id: 'spinwheel', label: 'Spin Wheel', icon: Disc },
    { id: 'predictionmarket', label: 'Prediction Market', icon: BarChart3 },
    { id: 'ludo', label: 'Ludo', icon: Dice5 },
    { id: 'rtp', label: 'RTP Control', icon: Percent },
    { id: 'sports', label: 'Sports', icon: Trophy },
    { id: 'games', label: 'Game Mgmt', icon: Gamepad2 },
    { id: 'banners', label: 'Banners', icon: Image },
    { id: 'welcomepopup', label: 'Welcome Popup', icon: Sparkles },
    { id: 'turnover', label: 'Turnover', icon: TrendingUp },
    { id: 'referral', label: 'Referral', icon: Link2 },
    { id: 'support', label: 'Support', icon: MessageCircle },
    { id: 'payment', label: 'Payment Numbers', icon: CreditCard },
    { id: 'airdrop', label: 'Airdrop Feedback', icon: MessageSquare },
  ];

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-white transition-colors">
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Shield size={20} className="text-neon-green" />
          <h2 className="font-display text-xl font-bold text-white">Admin Dashboard</h2>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-neon-red transition-colors px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-card"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-neon-green text-dark-bg neon-green-glow'
                  : 'bg-dark-card text-gray-400 border border-dark-border hover:text-white'
              }`}
            >
              <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'deposits' && <DepositsTab />}
      {tab === 'withdraws' && <WithdrawsTab />}
      {tab === 'crash' && <AviatorControlTab />}
      {tab === 'superace' && <SuperAceControlTab />}
      {tab === 'flyx' && <FlyXControlTab />}
      {tab === 'superelements' && <SuperElementsControlTab />}
      {tab === 'roulette' && <RouletteControlTab />}
      {tab === 'slots' && <SlotMachineControlTab />}
      {tab === 'spinwheel' && <SpinWheelControlTab />}
      {tab === 'predictionmarket' && <PredictionMarketControlTab />}
      {tab === 'ludo' && <LudoControlTab />}
      {tab === 'rtp' && <RtpSettingsTab />}
      {tab === 'sports' && <SportsManagementTab />}
      {tab === 'games' && <GameManagementTab />}
      {tab === 'banners' && (
        <div className="space-y-8">
          <BannerControlTab storagePath="game_settings/banners" title="Home Page Banners" />
          <BannerControlTab storagePath="game_settings/promotion_banners" title="Promotion Page Banners" />
        </div>
      )}
      {tab === 'welcomepopup' && <WelcomePopupControlTab />}
      {tab === 'turnover' && <TurnoverControlTab />}
      {tab === 'referral' && <ReferralControlTab />}
      {tab === 'support' && <SupportTab />}
      {tab === 'payment' && <PaymentNumbersTab />}
      {tab === 'airdrop' && <AirdropFeedbackTab />}
    </div>
  );
}

// ── Payment Numbers Tab ────────────────────────────────
const PAYMENT_METHOD_IDS = ['nagad', 'bkash', 'rocket', 'binance', 'upay', 'usdt', 'bybit', 'bitget'];

function PaymentNumbersTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState<Record<string, string>>({});

  useEffect(() => {
    let timedOut = false;

    (async () => {
      try {
        const snap = await get(ref(db, 'game_settings/payment_numbers'));
        if (timedOut) return;
        if (snap.exists()) {
          setNumbers(snap.val().numbers || {});
          setInstructions(snap.val().instructions || {});
        }
        setLoading(false);
      } catch {
        if (!timedOut) setLoading(false);
      }
    })();

    const timeout = setTimeout(() => {
      timedOut = true;
      setLoading(false);
    }, 8000);

    let unsub: (() => void) | null = null;
    try {
      unsub = onValue(
        ref(db, 'game_settings/payment_numbers'),
        (snap) => {
          if (snap.exists()) {
            setNumbers(snap.val().numbers || {});
            setInstructions(snap.val().instructions || {});
          }
        },
      );
    } catch {
      // ignore — initial get already handled loading state
    }

    return () => {
      clearTimeout(timeout);
      if (unsub) unsub();
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    const cleanedNumbers: Record<string, string> = {};
    const cleanedInstructions: Record<string, string> = {};
    PAYMENT_METHOD_IDS.forEach((id) => {
      cleanedNumbers[id] = (numbers[id] || '').trim();
      cleanedInstructions[id] = (instructions[id] || '').trim();
    });
    try {
      await set(ref(db, 'game_settings/payment_numbers'), {
        numbers: cleanedNumbers,
        instructions: cleanedInstructions,
        updatedAt: Date.now(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading payment settings...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard size={18} className="text-neon-green" />
          <h3 className="font-display text-base font-bold text-white">Deposit Payment Numbers</h3>
        </div>
        <p className="text-xs text-gray-500">
          Set the phone number and custom instructions for each payment method. Changes instantly update the deposit page for all users.
        </p>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        {PAYMENT_METHOD_IDS.map((methodId) => (
          <div key={methodId} className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 font-semibold mb-1 block capitalize">{methodId} Number</label>
              <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5">
                <CreditCard size={16} className="text-gray-500 mr-2 shrink-0" />
                <input
                  type="tel"
                  value={numbers[methodId] || ''}
                  onChange={(e) => setNumbers((prev) => ({ ...prev, [methodId]: e.target.value }))}
                  placeholder={`Enter ${methodId} number`}
                  className="bg-transparent text-white text-sm w-full outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold mb-1 block capitalize">{methodId} Instructions</label>
              <textarea
                value={instructions[methodId] || ''}
                onChange={(e) => setInstructions((prev) => ({ ...prev, [methodId]: e.target.value }))}
                placeholder={`Enter instructions shown to users when depositing via ${methodId}`}
                rows={2}
                className="w-full bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-green/40 resize-none"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        {saving ? 'Saving...' : saveError ? (
          <><AlertCircle size={18} strokeWidth={2.5} /> Save failed</>
        ) : saved ? (
          <><Check size={18} strokeWidth={2.5} /> Saved successfully!</>
        ) : (
          <><Settings size={18} strokeWidth={2.5} /> Save Settings</>
        )}
      </button>
    </div>
  );
}

// ── Turnover Control Tab ─────────────────────────────
function TurnoverControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [target, setTarget] = useState('100');

  useEffect(() => {
    (async () => {
      const snap = await get(ref(db, 'game_settings/turnover'));
      if (snap.exists()) {
        setTarget((snap.val().target ?? 100).toString());
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await set(ref(db, 'game_settings/turnover'), {
        target: parseFloat(target) || 0,
        updatedAt: Date.now(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading turnover settings...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={18} className="text-neon-green" />
          <h3 className="font-display text-base font-bold text-white">Turnover Target</h3>
        </div>
        <p className="text-xs text-gray-500">
          Set the target amount users need to reach in total bets. This controls the progress bar and message shown on the profile page.
        </p>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <h4 className="text-sm font-bold text-white">Target Amount</h4>
        <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5">
          <span className="text-neon-gold font-bold text-sm mr-1">৳</span>
          <input
            type="number"
            min="0"
            step="10"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="bg-transparent text-white text-sm w-full outline-none"
          />
        </div>
        <p className="text-xs text-gray-500">
          Users will see "আরো {target} টাকার গেম খেলুন" (or equivalent in their language) until they reach this amount in total bets.
        </p>

        <div className="grid grid-cols-4 gap-2 pt-1">
          {['50', '100', '500', '1000'].map((preset) => (
            <button
              key={preset}
              onClick={() => setTarget(preset)}
              className={`text-xs font-semibold py-2 rounded-lg transition-colors ${
                target === preset
                  ? 'bg-neon-green text-dark-bg'
                  : 'bg-dark-card2 text-gray-300 border border-dark-border hover:bg-dark-border'
              }`}
            >
              ৳{preset}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        {saving ? 'Saving...' : saveError ? (
          <><AlertCircle size={18} strokeWidth={2.5} /> Save failed</>
        ) : saved ? (
          <><Check size={18} strokeWidth={2.5} /> Saved successfully!</>
        ) : (
          <><Settings size={18} strokeWidth={2.5} /> Save Settings</>
        )}
      </button>
    </div>
  );
}

// ── Referral Control Tab ──────────────────────────────
function ReferralControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [link, setLink] = useState('https://24xbet-mobile-gaming-veau.bolt.host');

  useEffect(() => {
    (async () => {
      const snap = await get(ref(db, 'game_settings/referral'));
      if (snap.exists() && snap.val().link) {
        setLink(snap.val().link);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await set(ref(db, 'game_settings/referral'), {
        link: link.trim(),
        updatedAt: Date.now(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading referral settings...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 size={18} className="text-neon-green" />
          <h3 className="font-display text-base font-bold text-white">Global Referral Link</h3>
        </div>
        <p className="text-xs text-gray-500">
          This link is shared by all users. Changing it here instantly updates the referral link for every existing and new user.
        </p>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <h4 className="text-sm font-bold text-white">Referral URL</h4>
        <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5">
          <Link2 size={16} className="text-gray-500 mr-2 shrink-0" />
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://your-domain.com"
            className="bg-transparent text-white text-sm w-full outline-none"
          />
        </div>
        <p className="text-xs text-gray-500">
          Users will share: <span className="text-gray-300 font-mono break-all">{link}?ref=THEIR_CODE</span>
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        {saving ? 'Saving...' : saveError ? (
          <><AlertCircle size={18} strokeWidth={2.5} /> Save failed</>
        ) : saved ? (
          <><Check size={18} strokeWidth={2.5} /> Saved successfully!</>
        ) : (
          <><Settings size={18} strokeWidth={2.5} /> Save Link</>
        )}
      </button>
    </div>
  );
}

// ── Support Tab (Live Chat) ────────────────────────────────
interface AdminChatMessage {
  id: string;
  sender: 'user' | 'admin';
  text: string;
  createdAt: number;
}

interface Conversation {
  userId: string;
  userName: string;
  userPhone: string;
  lastMessage: string;
  lastAt: number;
  status: string;
}

function SupportTab() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<AdminChatMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  selectedUserIdRef.current = selectedUserId;

  // Load conversation list and subscribe to realtime updates
  useEffect(() => {
    const unsub = onValue(ref(db, 'support/conversations'), (snap) => {
      const raw = (snap.val() || {}) as Record<string, Partial<{ userName: string; userPhone: string; lastMessage: string; lastAt: number; status: string }>>;
      const list: Conversation[] = Object.entries(raw)
        .filter(([, r]) => r && typeof r === 'object')
        .map(([userId, r]) => ({
          userId,
          userName: r.userName || 'Unknown',
          userPhone: r.userPhone || '',
          lastMessage: r.lastMessage || '',
          lastAt: Number(r.lastAt) || 0,
          status: r.status || 'open',
        }))
        .sort((a, b) => b.lastAt - a.lastAt);
      setConversations(list);
      setLoading(false);
      const uid = selectedUserIdRef.current;
      if (uid) {
        const found = list.find((c) => c.userId === uid);
        if (found) setSelectedConv(found);
      }
    }, () => setLoading(false));

    return () => unsub();
  }, []);

  // Load chat messages for selected user and subscribe to realtime updates
  useEffect(() => {
    if (!selectedUserId) {
      setChatMessages([]);
      return;
    }

    const unsub = onValue(ref(db, `support/messages/${selectedUserId}`), (snap) => {
      const raw = (snap.val() || {}) as Record<string, { sender?: string; text?: string; createdAt?: number }>;
      const list: AdminChatMessage[] = Object.entries(raw)
        .filter(([, m]) => m && typeof m.text === 'string')
        .map(([id, m]): AdminChatMessage => ({
          id,
          sender: m.sender === 'admin' ? 'admin' : 'user',
          text: m.text as string,
          createdAt: Number(m.createdAt) || 0,
        }))
        .sort((a, b) => a.createdAt - b.createdAt);
      setChatMessages(list);
    });

    return () => unsub();
  }, [selectedUserId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleSelectConv = (conv: Conversation) => {
    setSelectedUserId(conv.userId);
    setSelectedConv(conv);
  };

  const handleBack = () => {
    setSelectedUserId(null);
    setSelectedConv(null);
  };

  const handleReply = async () => {
    const text = replyText.trim();
    if (!text || !selectedUserId || sending) return;

    setSending(true);
    setReplyText('');

    const now = Date.now();
    try {
      await set(push(ref(db, `support/messages/${selectedUserId}`)), {
        sender: 'admin',
        text,
        status: 'open',
        createdAt: now,
      });

      await update(ref(db, `support/conversations/${selectedUserId}`), {
        userName: selectedConv?.userName || 'Unknown',
        userPhone: selectedConv?.userPhone || '',
        lastMessage: text,
        lastAt: now,
        status: 'open',
        updatedAt: now,
      });
    } catch {
      // Silently ignore
    }

    setSending(false);
  };

  const handleResolve = async () => {
    if (!selectedConv) return;
    await update(ref(db, `support/conversations/${selectedConv.userId}`), {
      status: 'resolved',
      updatedAt: Date.now(),
    });
    setSelectedConv((prev) => prev ? { ...prev, status: 'resolved' } : null);
    setConversations((prev) =>
      prev.map((c) => c.userId === selectedConv.userId ? { ...c, status: 'resolved' } : c)
    );
  };

  // ── Chat view (selected conversation) ──
  if (selectedUserId && selectedConv) {
    return (
      <div className="flex flex-col" style={{ minHeight: '70vh' }}>
        {/* Chat header */}
        <div className="shrink-0 bg-dark-card rounded-xl border border-dark-border p-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-dark-card2 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-dark-bg">{selectedConv.userName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{selectedConv.userName}</p>
            <p className="text-xs text-gray-500">{selectedConv.userPhone || 'No phone'}</p>
          </div>
          {selectedConv.status === 'open' ? (
            <button
              onClick={handleResolve}
              className="bg-neon-green/10 text-neon-green font-bold text-[10px] px-2.5 py-1.5 rounded-lg hover:bg-neon-green/20 transition-colors flex items-center gap-1 shrink-0"
            >
              <Check size={12} /> Resolve
            </button>
          ) : (
            <span className="text-[9px] font-bold bg-neon-blue/20 text-neon-blue px-2 py-1 rounded-full shrink-0">RESOLVED</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle size={32} className="text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">No messages yet</p>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    msg.sender === 'admin'
                      ? 'bg-neon-green text-dark-bg rounded-br-md'
                      : 'bg-dark-card2 text-gray-200 border border-dark-border rounded-bl-md'
                  }`}
                >
                  {msg.sender === 'user' && (
                    <p className="text-[9px] font-bold text-neon-blue mb-0.5 flex items-center gap-1">
                      <Headphones size={9} /> User
                    </p>
                  )}
                  <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                  <p className={`text-[8px] mt-1 ${msg.sender === 'admin' ? 'text-dark-bg/50' : 'text-gray-600'}`}>
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply input */}
        <div className="shrink-0 bg-dark-card rounded-xl border border-dark-border p-2.5 flex items-end gap-2">
          <div className="flex-1 bg-dark-card2 rounded-xl border border-dark-border flex items-center px-3 py-2.5 focus-within:border-neon-green/30 transition-colors">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReply()}
              placeholder="Type your reply..."
              className="bg-transparent text-white text-sm w-full outline-none placeholder:text-gray-600"
              disabled={sending}
            />
          </div>
          <button
            onClick={handleReply}
            disabled={!replyText.trim() || sending}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(145deg, #00ff88, #00cc6a)',
              boxShadow: '0 4px 12px rgba(0,255,136,0.25)',
            }}
          >
            <Send size={18} className="text-dark-bg" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  // ── Conversation list view ──
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-dark-card rounded-lg border border-dark-border p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total</p>
          <p className="font-display text-lg font-bold text-white">{conversations.length}</p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Open</p>
          <p className="font-display text-lg font-bold text-neon-green">{conversations.filter((c) => c.status === 'open').length}</p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Resolved</p>
          <p className="font-display text-lg font-bold text-neon-blue">{conversations.filter((c) => c.status === 'resolved').length}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-500 py-8">Loading conversations...</p>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageCircle size={36} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">No support conversations yet</p>
          <p className="text-xs text-gray-600 mt-1">When users send a message, it will appear here in real time.</p>
        </div>
      ) : (
        conversations.map((conv) => (
          <button
            key={conv.userId}
            onClick={() => handleSelectConv(conv)}
            className="w-full bg-dark-card rounded-xl border border-dark-border p-3 flex items-center gap-3 hover:border-neon-green/30 transition-colors text-left active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-dark-bg">{conv.userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-white truncate">{conv.userName}</p>
                {conv.status === 'open' && (
                  <span className="text-[8px] font-bold bg-neon-green/20 text-neon-green px-1.5 py-0.5 rounded-full shrink-0">OPEN</span>
                )}
                {conv.status === 'resolved' && (
                  <span className="text-[8px] font-bold bg-neon-blue/20 text-neon-blue px-1.5 py-0.5 rounded-full shrink-0">RESOLVED</span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">{conv.lastMessage}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">
                {conv.lastAt ? new Date(conv.lastAt).toLocaleString() : ''}
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-600 shrink-0" />
          </button>
        ))
      )}
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const [editName, setEditName] = useState('');
  const [editTurnover, setEditTurnover] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifSent, setNotifSent] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const snap = await get(ref(db, 'users'));
    const list: AdminUser[] = [];
    if (snap.exists()) {
      const val = snap.val() as Record<string, any>;
      Object.entries(val).forEach(([id, data]) => {
        list.push({
          id,
          email: data.email || '',
          password: data.password || '',
          name: data.name || '',
          phone: data.phone || '',
          balance: data.balance || 0,
          status: data.status || 'active',
          approved: data.approved !== false,
          createdAt: data.createdAt || 0,
          turnover: data.turnover || 0,
          turnoverTarget: data.turnoverTarget ?? null,
        });
      });
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    setUsers(list);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSave = async (id: string) => {
    const updates: { balance?: number; name?: string; turnoverTarget?: number | null } = {};
    if (editBalance !== '') updates.balance = parseFloat(editBalance);
    if (editName !== '') updates.name = editName;
    if (editTurnover !== '') {
      const val = parseFloat(editTurnover);
      updates.turnoverTarget = isNaN(val) ? null : val;
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(db, 'users/' + id), updates);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...updates } as AdminUser : u));
    }
    setEditingId(null);
    setEditBalance('');
    setEditName('');
    setEditTurnover('');
  };

  const toggleStatus = async (user: AdminUser) => {
    const newStatus = user.status === 'active' ? 'banned' : 'active';
    await update(ref(db, 'users/' + user.id), { status: newStatus });
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: newStatus } : u));
  };

  const toggleApproved = async (user: AdminUser) => {
    const newApproved = !user.approved;
    await update(ref(db, 'users/' + user.id), { approved: newApproved });
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, approved: newApproved } : u));
  };

  const handleSendNotification = async (targetUid: string) => {
    const title = notifTitle.trim() || '24xbet';
    const body = notifBody.trim();
    if (!body) return;
    setSendingNotif(true);
    try {
      await sendCustomNotification(targetUid, title, body);
      setNotifSent(true);
      setNotifTitle('');
      setNotifBody('');
      setTimeout(() => setNotifSent(false), 2500);
    } catch {
      // ignore
    }
    setSendingNotif(false);
  };

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center bg-dark-card2 rounded-xl border border-dark-border px-3 py-2.5">
        <Search size={16} className="text-gray-500 mr-2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email..."
          className="bg-transparent text-white text-sm w-full outline-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-dark-card rounded-lg border border-dark-border p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total</p>
          <p className="font-display text-lg font-bold text-white">{users.length}</p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Active</p>
          <p className="font-display text-lg font-bold text-neon-green">{users.filter((u) => u.status === 'active').length}</p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Banned</p>
          <p className="font-display text-lg font-bold text-neon-red">{users.filter((u) => u.status === 'banned').length}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-500 py-8">Loading users...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">No users found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <div key={user.id} className="bg-dark-card rounded-xl border border-dark-border p-3">
              {editingId === user.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={user.name}
                    className="w-full bg-dark-card2 border border-dark-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-neon-green/40"
                  />
                  <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2">
                    <span className="text-neon-gold font-bold text-sm mr-1">৳</span>
                    <input
                      type="number"
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      placeholder={user.balance.toString()}
                      className="bg-transparent text-white text-sm w-full outline-none"
                    />
                  </div>
                  <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2">
                    <span className="text-neon-green font-bold text-sm mr-1">৳</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={editTurnover}
                      onChange={(e) => setEditTurnover(e.target.value)}
                      placeholder={user.turnoverTarget != null ? user.turnoverTarget.toString() : 'Global default'}
                      className="bg-transparent text-white text-sm w-full outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 -mt-1">Turnover target for this user (leave blank = use global)</p>

                  {/* Push notification sender */}
                  <div className="bg-dark-card2 border border-dark-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Bell size={13} className="text-neon-blue" />
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Send Push Notification</p>
                    </div>
                    <input
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      placeholder="Notification title (optional)"
                      className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-2 text-white text-xs outline-none focus:border-neon-blue/40"
                    />
                    <textarea
                      value={notifBody}
                      onChange={(e) => setNotifBody(e.target.value)}
                      placeholder="Notification message..."
                      rows={2}
                      className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-2 text-white text-xs outline-none focus:border-neon-blue/40 resize-none"
                    />
                    <button
                      onClick={() => handleSendNotification(user.id)}
                      disabled={!notifBody.trim() || sendingNotif}
                      className="w-full bg-neon-blue/15 text-neon-blue font-bold text-xs py-2 rounded-lg hover:bg-neon-blue/25 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      {notifSent ? <><Check size={13} /> Sent!</> : <><Send size={13} /> {sendingNotif ? 'Sending...' : 'Send Notification'}</>}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(user.id)}
                      className="flex-1 bg-neon-green text-dark-bg font-bold text-xs py-2 rounded-lg active:scale-95"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 bg-dark-card2 text-gray-400 font-semibold text-xs py-2 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-dark-bg">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white truncate">{user.name}</p>
                      {user.status === 'banned' && (
                        <span className="text-[8px] font-bold bg-neon-red/20 text-neon-red px-1.5 py-0.5 rounded-full">BANNED</span>
                      )}
                      {!user.approved && (
                        <span className="text-[8px] font-bold bg-neon-gold/20 text-neon-gold px-1.5 py-0.5 rounded-full">PENDING</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{user.phone || user.email}</p>
                    {user.password && (
                      <p className="text-xs text-gray-400 font-mono">Pass: {user.password}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-sm font-bold text-neon-gold">৳{user.balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-gray-600">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''}</p>
                  </div>
                </div>
              )}

              {editingId !== user.id && (
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => { setEditingId(user.id); setEditBalance(''); setEditName(''); setEditTurnover(''); setNotifTitle(''); setNotifBody(''); }}
                    className="flex-1 bg-dark-card2 text-gray-300 text-xs font-semibold py-1.5 rounded-lg hover:bg-dark-border transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleApproved(user)}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                      user.approved
                        ? 'bg-neon-gold/10 text-neon-gold hover:bg-neon-gold/20'
                        : 'bg-neon-green/10 text-neon-green hover:bg-neon-green/20'
                    }`}
                  >
                    {user.approved ? 'Unapprove' : 'Approve'}
                  </button>
                  <button
                    onClick={() => toggleStatus(user)}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                      user.status === 'active'
                        ? 'bg-neon-red/10 text-neon-red hover:bg-neon-red/20'
                        : 'bg-neon-green/10 text-neon-green hover:bg-neon-green/20'
                    }`}
                  >
                    {user.status === 'active' ? 'Ban' : 'Unban'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Deposits Tab ───────────────────────────────────────
function DepositsTab() {
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await get(ref(db, 'deposit_requests'));
      const list: AdminDeposit[] = [];
      if (snap.exists()) {
        const val = snap.val() as Record<string, any>;
        Object.entries(val).forEach(([id, data]) => {
          list.push({
            id,
            userId: data.userId || '',
            userName: data.userName || 'Unknown',
            userPhone: data.userPhone || '',
            method: data.method || '',
            amount: data.amount || 0,
            status: data.status || 'pending',
            senderNumber: data.senderNumber || '',
            trxId: data.trxId || '',
            createdAt: data.createdAt || 0,
          });
        });
      }
      list.sort((a, b) => b.createdAt - a.createdAt);
      setDeposits(list);
    } catch {
      // Collection missing or inaccessible — show empty state
      setDeposits([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const handleApprove = async (deposit: AdminDeposit) => {
    await update(ref(db, 'deposit_requests/' + deposit.id), { status: 'approved' });
    const userRef = ref(db, 'users/' + deposit.userId);
    const userSnap = await get(userRef);
    if (userSnap.exists()) {
      const ud = userSnap.val();
      const currentBalance = ud.balance || 0;
      await update(userRef, { balance: currentBalance + deposit.amount });

      if (ud.referredBy && deposit.amount >= 1000) {
        const usersSnap = await get(ref(db, 'users'));
        if (usersSnap.exists()) {
          const allUsers = usersSnap.val() as Record<string, any>;
          let referrerUid = '';
          for (const uid in allUsers) {
            if (allUsers[uid].referralCode === ud.referredBy) { referrerUid = uid; break; }
          }
          if (referrerUid) {
            const rd = allUsers[referrerUid];
            const referrerRef = ref(db, 'users/' + referrerUid);
            await update(referrerRef, {
              balance: (rd.balance || 0) + 500,
              pendingRefers: Math.max(0, (rd.pendingRefers || 0) - 1),
              completedRefers: (rd.completedRefers || 0) + 1,
              referralEarnings: (rd.referralEarnings || 0) + 500,
            });

            const referralsSnap = await get(ref(db, 'referrals'));
            if (referralsSnap.exists()) {
              const allReferrals = referralsSnap.val() as Record<string, any>;
              for (const rId in allReferrals) {
                const r = allReferrals[rId];
                if (r.referredUid === deposit.userId && r.status === 'pending') {
                  await update(ref(db, 'referrals/' + rId), {
                    status: 'completed',
                    completedAt: Date.now(),
                  });
                  break;
                }
              }
            }
          }
        }
      }
    }
    await sendCustomNotification(
      deposit.userId,
      'Deposit Approved',
      `Your deposit of ৳${deposit.amount} has been approved and added to your balance.`
    );
    setDeposits((prev) => prev.map((d) => d.id === deposit.id ? { ...d, status: 'approved' } : d));
  };

  const handleReject = async (deposit: AdminDeposit) => {
    await update(ref(db, 'deposit_requests/' + deposit.id), { status: 'rejected' });
    await sendCustomNotification(
      deposit.userId,
      'Deposit Rejected',
      `Your deposit request of ৳${deposit.amount} was rejected. Please contact support.`
    );
    setDeposits((prev) => prev.map((d) => d.id === deposit.id ? { ...d, status: 'rejected' } : d));
  };

  const methodColors: Record<string, string> = {
    nagad: '#ee7a1e', bkash: '#e2136e', rocket: '#8b2c8e', binance: '#f0b90b',
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-center text-sm text-gray-500 py-8">Loading deposits...</p>
      ) : deposits.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">No deposit requests</p>
      ) : (
        deposits.map((deposit) => (
          <div key={deposit.id} className="bg-dark-card rounded-xl border border-dark-border p-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white"
                style={{ backgroundColor: methodColors[deposit.method] || '#333' }}
              >
                {deposit.method.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{deposit.userName}</p>
                <p className="text-xs text-gray-500">
                  {deposit.method.toUpperCase()}
                </p>
                {deposit.trxId && (
                  <p className="text-xs text-neon-blue font-semibold mt-0.5">
                    প্রেরকের নাম্বার: {deposit.trxId}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-sm font-bold text-neon-green">+৳{deposit.amount}</p>
                <p className="text-[10px] text-gray-600">{deposit.createdAt ? new Date(deposit.createdAt).toLocaleDateString() : ''}</p>
              </div>
            </div>

            {deposit.status === 'pending' ? (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleApprove(deposit)}
                  className="flex-1 bg-neon-green/10 text-neon-green font-bold text-xs py-2 rounded-lg hover:bg-neon-green/20 transition-colors flex items-center justify-center gap-1"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  onClick={() => handleReject(deposit)}
                  className="flex-1 bg-neon-red/10 text-neon-red font-bold text-xs py-2 rounded-lg hover:bg-neon-red/20 transition-colors flex items-center justify-center gap-1"
                >
                  <X size={14} /> Reject
                </button>
              </div>
            ) : (
              <div className={`mt-2 text-center text-xs font-bold py-1.5 rounded-lg ${
                deposit.status === 'approved'
                  ? 'bg-neon-green/10 text-neon-green'
                  : 'bg-neon-red/10 text-neon-red'
              }`}>
                {deposit.status.toUpperCase()}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Withdraws Tab ──────────────────────────────────────
function WithdrawsTab() {
  const [withdraws, setWithdraws] = useState<AdminWithdraw[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithdraws = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await get(ref(db, 'withdraw_requests'));
      const list: AdminWithdraw[] = [];
      if (snap.exists()) {
        const val = snap.val() as Record<string, any>;
        Object.entries(val).forEach(([id, data]) => {
          list.push({
            id,
            userId: data.userId || '',
            userName: data.userName || 'Unknown',
            userPhone: data.userPhone || '',
            method: data.method || '',
            amount: data.amount || 0,
            accountNumber: data.accountNumber || '',
            status: data.status || 'pending',
            createdAt: data.createdAt || 0,
          });
        });
      }
      list.sort((a, b) => b.createdAt - a.createdAt);
      setWithdraws(list);
    } catch {
      setWithdraws([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchWithdraws(); }, [fetchWithdraws]);

  const handleApprove = async (withdraw: AdminWithdraw) => {
    await update(ref(db, 'withdraw_requests/' + withdraw.id), { status: 'approved' });
    await sendCustomNotification(
      withdraw.userId,
      'Withdrawal Successful',
      `Your withdrawal of ৳${withdraw.amount} has been sent to your ${withdraw.method} account.`
    );
    setWithdraws((prev) => prev.map((w) => w.id === withdraw.id ? { ...w, status: 'approved' } : w));
  };

  const handleReject = async (withdraw: AdminWithdraw) => {
    await update(ref(db, 'withdraw_requests/' + withdraw.id), { status: 'rejected' });
    const userRef = ref(db, 'users/' + withdraw.userId);
    const userSnap = await get(userRef);
    if (userSnap.exists()) {
      const currentBalance = userSnap.val().balance || 0;
      await update(userRef, { balance: currentBalance + withdraw.amount });
    }
    await sendCustomNotification(
      withdraw.userId,
      'Withdrawal Rejected',
      `Your withdrawal request of ৳${withdraw.amount} was rejected. The amount has been refunded to your balance.`
    );
    setWithdraws((prev) => prev.map((w) => w.id === withdraw.id ? { ...w, status: 'rejected' } : w));
  };

  const methodColors: Record<string, string> = {
    nagad: '#ee7a1e', bkash: '#e2136e',
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-center text-sm text-gray-500 py-8">Loading withdrawals...</p>
      ) : withdraws.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">No withdrawal requests</p>
      ) : (
        withdraws.map((withdraw) => (
          <div key={withdraw.id} className="bg-dark-card rounded-xl border border-dark-border p-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white"
                style={{ backgroundColor: methodColors[withdraw.method] || '#333' }}
              >
                {withdraw.method.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{withdraw.userName}</p>
                <p className="text-xs text-gray-500">
                  {withdraw.method.toUpperCase()} · {withdraw.accountNumber || 'N/A'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-sm font-bold text-neon-red">-৳{withdraw.amount}</p>
                <p className="text-[10px] text-gray-600">{withdraw.createdAt ? new Date(withdraw.createdAt).toLocaleDateString() : ''}</p>
              </div>
            </div>

            {withdraw.status === 'pending' ? (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleApprove(withdraw)}
                  className="flex-1 bg-neon-green/10 text-neon-green font-bold text-xs py-2 rounded-lg hover:bg-neon-green/20 transition-colors flex items-center justify-center gap-1"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  onClick={() => handleReject(withdraw)}
                  className="flex-1 bg-neon-red/10 text-neon-red font-bold text-xs py-2 rounded-lg hover:bg-neon-red/20 transition-colors flex items-center justify-center gap-1"
                >
                  <X size={14} /> Reject
                </button>
              </div>
            ) : (
              <div className={`mt-2 text-center text-xs font-bold py-1.5 rounded-lg ${
                withdraw.status === 'approved'
                  ? 'bg-neon-green/10 text-neon-green'
                  : 'bg-neon-red/10 text-neon-red'
              }`}>
                {withdraw.status.toUpperCase()}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Super Ace Control Tab ─────────────────────────────
type SuperAceDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

const DIFFICULTY_PRESETS: Record<SuperAceDifficulty, { label: string; color: string; payoutRange: string; scatterFreq: string; winRate: number; deadSpin: number }> = {
  easy: { label: 'Easy', color: '#00ff88', payoutRange: '50x - 100x', scatterFreq: '1 / 5-15 spins', winRate: 90, deadSpin: 10 },
  medium: { label: 'Medium', color: '#ffd700', payoutRange: '5x - 10x', scatterFreq: '1 / 15-30 spins', winRate: 80, deadSpin: 20 },
  hard: { label: 'Hard', color: '#ff9500', payoutRange: '0.1x - 1.5x', scatterFreq: '1 / 50-100 spins', winRate: 70, deadSpin: 30 },
  impossible: { label: 'Impossible', color: '#ff3366', payoutRange: '0.1x - 0.7x', scatterFreq: '1 / 500-1000 spins', winRate: 60, deadSpin: 40 },
};

function SuperAceControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [forceOutcome, setForceOutcome] = useState<'none' | 'win' | 'loss'>('none');
  const [difficulty, setDifficulty] = useState<SuperAceDifficulty>('medium');
  const [activeDifficulty, setActiveDifficulty] = useState<SuperAceDifficulty | null>(null);

  const [stats, setStats] = useState({ totalBets: 0, totalPayouts: 0, houseProfit: 0, activePlayers: 0 });

  useEffect(() => {
    (async () => {
      const snap = await get(ref(db, 'game_settings/superace'));
      if (snap.exists()) {
        const s = snap.val();
        setOverrideEnabled(s.overrideEnabled ?? false);
        setForceOutcome(s.forceOutcome ?? 'none');
        const d = (s.difficulty as SuperAceDifficulty) ?? 'medium';
        setDifficulty(d);
        setActiveDifficulty(d);
      }
      setLoading(false);
    })();

    // Live listener so the active-mode indicator stays in sync
    const settingsUnsub = onValue(ref(db, 'game_settings/superace'), (snap) => {
      if (snap.exists()) {
        const d = (snap.val().difficulty as SuperAceDifficulty) ?? 'medium';
        setActiveDifficulty(d);
      }
    });

    const statsUnsub = onValue(
      ref(db, 'superace_bets'),
      (snap) => {
        let totalBets = 0;
        let totalPayouts = 0;
        const players = new Set<string>();
        if (snap.exists()) {
          const val = snap.val() as Record<string, any>;
          Object.entries(val).forEach(([, data]) => {
            totalBets += data.betAmount || 0;
            totalPayouts += data.payout || 0;
            if (data.userId) players.add(data.userId);
          });
        }
        setStats({
          totalBets,
          totalPayouts,
          houseProfit: totalBets - totalPayouts,
          activePlayers: players.size,
        });
      },
    );
    return () => { settingsUnsub(); statsUnsub(); };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await set(ref(db, 'game_settings/superace'), {
        multX1: 1,
        multX2: 2,
        multX3: 3,
        multX5: 5,
        overrideEnabled,
        forceOutcome,
        difficulty,
        updatedAt: Date.now(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading Super Ace settings...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Spade size={18} className="text-neon-gold" />
          <h3 className="font-display text-base font-bold text-white">Super Ace Game Control</h3>
        </div>
        <p className="text-xs text-gray-500">
          Select a difficulty preset to control payout range, scatter frequency, and win chance. Changes take effect on the next spin.
        </p>
      </div>

      {/* Difficulty Mode Selector */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Super Ace Difficulty</h4>
          {activeDifficulty && (
            <span
              className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full"
              style={{
                color: DIFFICULTY_PRESETS[activeDifficulty].color,
                backgroundColor: `${DIFFICULTY_PRESETS[activeDifficulty].color}18`,
                border: `1px solid ${DIFFICULTY_PRESETS[activeDifficulty].color}30`,
              }}
            >
              Active: {DIFFICULTY_PRESETS[activeDifficulty].label}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Selecting a difficulty directly controls payout range, scatter frequency, and win chance for all players.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(DIFFICULTY_PRESETS) as SuperAceDifficulty[]).map((d) => {
            const cfg = DIFFICULTY_PRESETS[d];
            const isSelected = difficulty === d;
            return (
              <button
                key={d}
                onClick={() => {
                  setDifficulty(d);
                }}
                className={`rounded-xl border p-3 text-left transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-dark-card2'
                    : 'bg-dark-card2/50 border-dark-border hover:bg-dark-card2'
                }`}
                style={isSelected ? { borderColor: cfg.color, boxShadow: `0 0 12px ${cfg.color}30` } : {}}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
                  />
                  <span className="text-sm font-bold" style={{ color: isSelected ? cfg.color : '#fff' }}>
                    {cfg.label}
                  </span>
                  {isSelected && <Check size={14} style={{ color: cfg.color }} />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-gray-500">Payout: <span className="text-gray-300 font-semibold">{cfg.payoutRange}</span></p>
                  <p className="text-[10px] text-gray-500">Scatter: <span className="text-gray-300 font-semibold">{cfg.scatterFreq}</span></p>
                  <p className="text-[10px] text-gray-500">Win Rate: <span className="text-gray-300 font-semibold">{cfg.winRate}%</span></p>
                  <p className="text-[10px] text-gray-500">No Match: <span className="text-gray-300 font-semibold">{cfg.deadSpin}%</span></p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Statistics */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-neon-green" />
          <h4 className="text-sm font-bold text-white">Live Statistics</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Total Bets</p>
            <p className="font-display text-lg font-bold text-white">৳{stats.totalBets.toFixed(2)}</p>
          </div>
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Total Payouts</p>
            <p className="font-display text-lg font-bold text-neon-green">৳{stats.totalPayouts.toFixed(2)}</p>
          </div>
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">House Profit</p>
            <p className={`font-display text-lg font-bold ${stats.houseProfit >= 0 ? 'text-neon-gold' : 'text-neon-red'}`}>
              ৳{stats.houseProfit.toFixed(2)}
            </p>
          </div>
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Active Players</p>
            <p className="font-display text-lg font-bold text-neon-blue">{stats.activePlayers}</p>
          </div>
        </div>
      </div>

      {/* Manual Result Override */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-neon-red" />
            <h4 className="text-sm font-bold text-white">Manual Result Override</h4>
          </div>
          <button
            onClick={() => setOverrideEnabled((v) => !v)}
            className="shrink-0 transition-transform active:scale-90"
          >
            {overrideEnabled ? (
              <ToggleRight size={32} className="text-neon-green" />
            ) : (
              <ToggleLeft size={32} className="text-gray-600" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Force the next spin to always win or always lose for testing. Disable to return to normal RNG.
        </p>
        {overrideEnabled && (
          <div className="grid grid-cols-3 gap-2">
            {(['none', 'win', 'loss'] as const).map((outcome) => (
              <button
                key={outcome}
                onClick={() => setForceOutcome(outcome)}
                className={`text-xs font-bold py-2.5 rounded-lg transition-all ${
                  forceOutcome === outcome
                    ? outcome === 'win'
                      ? 'bg-neon-green text-dark-bg'
                      : outcome === 'loss'
                      ? 'bg-neon-red text-white'
                      : 'bg-neon-gold text-dark-bg'
                    : 'bg-dark-card2 text-gray-400 border border-dark-border'
                }`}
              >
                {outcome === 'none' ? 'Normal' : outcome === 'win' ? 'Force Win' : 'Force Loss'}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-neon-gold text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-gold/90 disabled:opacity-50 neon-gold-glow flex items-center justify-center gap-2"
      >
        {saving ? 'Saving...' : saveError ? (
          <><AlertCircle size={18} strokeWidth={2.5} /> Save failed</>
        ) : saved ? (
          <><Check size={18} strokeWidth={2.5} /> Saved successfully!</>
        ) : (
          <><Settings size={18} strokeWidth={2.5} /> Save Settings</>
        )}
      </button>
    </div>
  );
}

// ── RTP Settings Tab ──────────────────────────────────
const RTP_GAMES = [
  { key: 'aviator', label: 'Aviator', path: 'game_settings/aviator', defaultRtp: 85, color: '#00ff88' },
  { key: 'flyx', label: 'FlyX', path: 'game_settings/flyx', defaultRtp: 80, color: '#ff3366' },
  { key: 'slots', label: 'Slot Machine', path: 'game_settings/slots', defaultRtp: 92, color: '#ffd700' },
  { key: 'superace', label: 'Super Ace', path: 'game_settings/superace', defaultRtp: 85, color: '#ffd700' },
  { key: 'roulette', label: 'Roulette', path: 'game_settings/roulette', defaultRtp: 92, color: '#ffd700' },
  { key: 'spinwheel', label: 'Spin Wheel', path: 'game_settings/spinwheel', defaultRtp: 90, color: '#00ff88' },
  { key: 'ludo', label: 'Ludo', path: 'game_settings/ludo', defaultRtp: 95, color: '#00ff88' },
  { key: 'trading', label: 'Trading', path: 'game_settings/trading', defaultRtp: 90, color: '#00ff88' },
  { key: 'superelements', label: 'Super Elements', path: 'game_settings/superelements', defaultRtp: 85, color: '#ff9500' },
];

function RtpSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [rtpValues, setRtpValues] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const values: Record<string, number> = {};
      await Promise.all(RTP_GAMES.map(async (g) => {
        try {
          const snap = await get(ref(db, g.path));
          if (snap.exists()) {
            values[g.key] = snap.val().rtp ?? g.defaultRtp;
          } else {
            values[g.key] = g.defaultRtp;
          }
        } catch {
          values[g.key] = g.defaultRtp;
        }
      }));
      setRtpValues(values);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await Promise.all(RTP_GAMES.map(async (g) => {
        const rtp = rtpValues[g.key] ?? g.defaultRtp;
        await update(ref(db, g.path), { rtp, updatedAt: Date.now() });
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading RTP settings...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Percent size={18} className="text-neon-green" />
          <h3 className="font-display text-base font-bold text-white">RTP Control (All Games)</h3>
        </div>
        <p className="text-xs text-gray-500">
          Set the Return to Player percentage for every game. RTP controls how much of each bet is returned to players over time. Lower RTP = higher house edge. Changes sync instantly to all players via Firebase.
        </p>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-4">
        {RTP_GAMES.map((g) => {
          const val = rtpValues[g.key] ?? g.defaultRtp;
          return (
            <div key={g.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color, boxShadow: `0 0 6px ${g.color}` }} />
                <span className="text-sm font-bold text-white">{g.label}</span>
                <span className="ml-auto font-display text-lg font-bold" style={{ color: g.color }}>{val}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="20"
                  max="98"
                  step="1"
                  value={val}
                  onChange={(e) => setRtpValues((prev) => ({ ...prev, [g.key]: parseInt(e.target.value) }))}
                  className="flex-1"
                  style={{ accentColor: g.color }}
                />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Tight', val: 50 },
                  { label: 'Normal', val: 75 },
                  { label: 'Loose', val: 90 },
                  { label: 'Max', val: 96 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setRtpValues((prev) => ({ ...prev, [g.key]: preset.val }))}
                    className={`text-[10px] font-bold py-1.5 rounded-lg transition-colors ${
                      val === preset.val
                        ? 'bg-neon-green text-dark-bg'
                        : 'bg-dark-card2 text-gray-400 border border-dark-border hover:bg-dark-border'
                    }`}
                  >
                    {preset.label} {preset.val}%
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        {saving ? 'Saving...' : saveError ? (
          <><AlertCircle size={18} strokeWidth={2.5} /> Save failed</>
        ) : saved ? (
          <><Check size={18} strokeWidth={2.5} /> Saved successfully!</>
        ) : (
          <><Settings size={18} strokeWidth={2.5} /> Save All RTP Settings</>
        )}
      </button>
    </div>
  );
}
