import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Gift, CheckCircle2, Loader2, MessageSquare, Lightbulb, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db, ref, onValue, update, push, set } from '@/lib/firebase';
import ModalShell from '@/components/ModalShell';
import ExternalLinkModal from '@/components/ExternalLinkModal';

interface AirdropPageProps {
  onBack: () => void;
}

const TELEGRAM_URL = 'https://t.me/Bd24xbet';
const TELEGRAM_ICON = 'https://i.postimg.cc/Pr3scyhZ/images-(15).jpg';
const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61594871223129';
const FACEBOOK_ICON_URL = 'https://i.postimg.cc/4NjbJ8C5/images-(3).png';
const AIRDROP_ICON = 'https://i.postimg.cc/9XSDgh8D/Chat-GPT-Image-Sep-30-2026-05-17-57-AM.png';

const TASK_IDS = {
  TELEGRAM: 'join_telegram',
  FACEBOOK: 'follow_facebook',
  DEPOSIT: 'submit_deposit',
  ADVICE: 'give_advice',
  SUGGESTION: 'give_suggestion',
} as const;

const POINTS_PER_TASK = 10;
const TOTAL_POINTS = 50;

type ProcessingState = 'idle' | 'processing' | 'done';

export default function AirdropPage({ onBack }: AirdropPageProps) {
  const { user } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [hasClickedTelegram, setHasClickedTelegram] = useState(false);
  const [hasClickedFacebook, setHasClickedFacebook] = useState(false);
  const [telegramProcessing, setTelegramProcessing] = useState<ProcessingState>('idle');
  const [facebookProcessing, setFacebookProcessing] = useState<ProcessingState>('idle');
  const [adviceModalOpen, setAdviceModalOpen] = useState(false);
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [externalLink, setExternalLink] = useState<{ url: string; title: string; description: string; icon: React.ReactNode } | null>(null);
  const [nicknameModal, setNicknameModal] = useState<'telegram' | 'facebook' | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');
  const [nicknameError, setNicknameError] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const unsub = onValue(ref(db, 'airdrop_tasks/' + user.uid), (snap) => {
      if (snap.exists()) {
        setCompletedTasks(new Set(snap.val().completed ?? []));
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  const markTaskComplete = useCallback(async (taskId: string) => {
    if (!user) return;
    const updated = new Set(completedTasks);
    updated.add(taskId);
    setCompletedTasks(updated);
    try {
      await update(ref(db, 'airdrop_tasks/' + user.uid), {
        completed: Array.from(updated),
        updatedAt: Date.now(),
      });
    } catch {
      // ignore
    }
  }, [user, completedTasks]);

  const handleTelegramJoin = () => {
    setHasClickedTelegram(true);
    setExternalLink({
      url: TELEGRAM_URL,
      title: 'Join Telegram Channel',
      description: 'Copy the link and open it in Telegram or your browser.',
      icon: <img src={TELEGRAM_ICON} alt="Telegram" className="w-8 h-8 rounded-lg object-cover" />,
    });
  };

  const handleTelegramMarkDone = async () => {
    setNicknameModal('telegram');
    setNicknameValue('');
    setNicknameError(false);
  };

  const submitTelegramNickname = async () => {
    if (nicknameValue.trim().length < 2) {
      setNicknameError(true);
      return;
    }
    setNicknameModal(null);
    setTelegramProcessing('processing');
    setTimeout(async () => {
      setTelegramProcessing('done');
      await markTaskComplete(TASK_IDS.TELEGRAM);
      if (user) {
        try {
          await update(ref(db, 'airdrop_tasks/' + user.uid), {
            telegramNickname: nicknameValue.trim(),
          });
        } catch { /* ignore */ }
      }
    }, 1000);
  };

  const handleFacebookFollow = () => {
    setHasClickedFacebook(true);
    setExternalLink({
      url: FACEBOOK_URL,
      title: 'Follow Facebook Page',
      description: 'Copy the link and open it in the Facebook app or your browser.',
      icon: <img src={FACEBOOK_ICON_URL} alt="Facebook" className="w-8 h-8 rounded-lg object-cover" />,
    });
  };

  const handleFacebookMarkDone = async () => {
    setNicknameModal('facebook');
    setNicknameValue('');
    setNicknameError(false);
  };

  const submitFacebookNickname = async () => {
    if (nicknameValue.trim().length < 2) {
      setNicknameError(true);
      return;
    }
    setNicknameModal(null);
    setFacebookProcessing('processing');
    setTimeout(async () => {
      setFacebookProcessing('done');
      await markTaskComplete(TASK_IDS.FACEBOOK);
      if (user) {
        try {
          await update(ref(db, 'airdrop_tasks/' + user.uid), {
            facebookNickname: nicknameValue.trim(),
          });
        } catch { /* ignore */ }
      }
    }, 1000);
  };

  const handleAdviceSubmit = async (text: string) => {
    if (!user) return;
    const fbRef = push(ref(db, 'airdrop_feedback'));
    await set(fbRef, {
      userId: user.uid,
      userName: user.name || '',
      type: 'advice',
      text,
      createdAt: Date.now(),
    });
    await markTaskComplete(TASK_IDS.ADVICE);
    setAdviceModalOpen(false);
  };

  const handleSuggestionSubmit = async (text: string) => {
    if (!user) return;
    const fbRef = push(ref(db, 'airdrop_feedback'));
    await set(fbRef, {
      userId: user.uid,
      userName: user.name || '',
      type: 'suggestion',
      text,
      createdAt: Date.now(),
    });
    await markTaskComplete(TASK_IDS.SUGGESTION);
    setSuggestionModalOpen(false);
  };

  const earnedPoints = completedTasks.size * POINTS_PER_TASK;

  return (
    <div className="min-h-screen bg-dark-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-dark-card/95 backdrop-blur-sm border-b border-dark-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <img src={AIRDROP_ICON} alt="Airdrop" className="w-7 h-7 rounded-lg object-cover" />
          <h1 className="font-display text-base font-bold text-white">Telegram Community Airdrop Season 1</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Reward pool */}
        <div className="bg-gradient-to-br from-dark-card to-dark-card2 rounded-2xl border border-neon-gold/30 p-5 text-center">
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center mx-auto mb-3">
            <img src={AIRDROP_ICON} alt="Airdrop" className="w-full h-full object-cover rounded-2xl" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">Total reward pool 1500$</h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            Out of those who complete the task, 200 people will get randomly 4$-10$.
          </p>
        </div>

        {/* Your progress */}
        <div className="bg-dark-card rounded-2xl border border-dark-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Your progress</span>
            <span className="font-display text-sm font-bold text-neon-gold">{earnedPoints} Point</span>
          </div>
          <div className="h-2.5 bg-dark-card2 rounded-full overflow-hidden border border-dark-border">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-gold to-neon-green transition-all duration-500"
              style={{ width: `${(earnedPoints / TOTAL_POINTS) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-2">{completedTasks.size} of 5 tasks completed</p>
        </div>

        {/* Tasks */}
        {loading ? (
          <p className="text-center text-sm text-gray-500 py-6">Loading tasks...</p>
        ) : (
          <div className="space-y-3">
            {/* Task 1: Join Telegram */}
            <TaskCard
              number={1}
              icon={<img src={TELEGRAM_ICON} alt="Telegram" className="w-6 h-6 rounded-lg object-cover" />}
              title="Join telegram channel"
              rewardText="10 Points"
              isDone={completedTasks.has(TASK_IDS.TELEGRAM)}
            >
              {completedTasks.has(TASK_IDS.TELEGRAM) ? (
                <CompletedBadge />
              ) : telegramProcessing === 'processing' ? (
                <ProcessingBadge />
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTelegramJoin}
                    className="flex items-center gap-1.5 text-xs font-bold text-neon-blue bg-neon-blue/15 px-3 py-2 rounded-lg hover:bg-neon-blue/25 transition-colors"
                  >
                    Join
                  </button>
                  {hasClickedTelegram && telegramProcessing === 'idle' && (
                    <button
                      onClick={handleTelegramMarkDone}
                      className="text-xs font-semibold text-neon-green bg-neon-green/10 px-3 py-2 rounded-lg hover:bg-neon-green/20 transition-colors"
                    >
                      Mark Done
                    </button>
                  )}
                </div>
              )}
            </TaskCard>

            {/* Task 2: Follow Facebook */}
            <TaskCard
              number={2}
              icon={<img src={FACEBOOK_ICON_URL} alt="Facebook" className="w-6 h-6 rounded-lg object-cover" />}
              title="Follow Facebook page"
              rewardText="10 Points"
              isDone={completedTasks.has(TASK_IDS.FACEBOOK)}
            >
              {completedTasks.has(TASK_IDS.FACEBOOK) ? (
                <CompletedBadge />
              ) : facebookProcessing === 'processing' ? (
                <ProcessingBadge />
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFacebookFollow}
                    className="flex items-center gap-1.5 text-xs font-bold text-neon-blue bg-neon-blue/15 px-3 py-2 rounded-lg hover:bg-neon-blue/25 transition-colors"
                  >
                    Follow
                  </button>
                  {hasClickedFacebook && facebookProcessing === 'idle' && (
                    <button
                      onClick={handleFacebookMarkDone}
                      className="text-xs font-semibold text-neon-green bg-neon-green/10 px-3 py-2 rounded-lg hover:bg-neon-green/20 transition-colors"
                    >
                      Mark Done
                    </button>
                  )}
                </div>
              )}
            </TaskCard>

            {/* Task 3: Submit deposit request */}
            <TaskCard
              number={3}
              icon={
                <div className="w-6 h-6 rounded-lg bg-neon-green/15 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-neon-green">৳</span>
                </div>
              }
              title="Just submit a deposit Request"
              rewardText="10 Points"
              isDone={completedTasks.has(TASK_IDS.DEPOSIT)}
            >
              {completedTasks.has(TASK_IDS.DEPOSIT) ? (
                <CompletedBadge />
              ) : (
                <p className="text-xs text-gray-500">Auto-completes when you submit a deposit request.</p>
              )}
            </TaskCard>

            {/* Task 4: Give advice */}
            <TaskCard
              number={4}
              icon={
                <div className="w-6 h-6 rounded-lg bg-neon-blue/15 flex items-center justify-center">
                  <MessageSquare size={14} className="text-neon-blue" />
                </div>
              }
              title="Give us some advice"
              rewardText="10 Points"
              isDone={completedTasks.has(TASK_IDS.ADVICE)}
            >
              {completedTasks.has(TASK_IDS.ADVICE) ? (
                <CompletedBadge />
              ) : (
                <button
                  onClick={() => setAdviceModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-neon-blue bg-neon-blue/15 px-3 py-2 rounded-lg hover:bg-neon-blue/25 transition-colors"
                >
                  Write Advice
                </button>
              )}
            </TaskCard>

            {/* Task 5: Suggestion */}
            <TaskCard
              number={5}
              icon={
                <div className="w-6 h-6 rounded-lg bg-neon-gold/15 flex items-center justify-center">
                  <Lightbulb size={14} className="text-neon-gold" />
                </div>
              }
              title="আপনার মতে পরবর্তীতে কোন জিনিসটা যুক্ত করা উচিত?"
              rewardText="10 Points"
              isDone={completedTasks.has(TASK_IDS.SUGGESTION)}
            >
              {completedTasks.has(TASK_IDS.SUGGESTION) ? (
                <CompletedBadge />
              ) : (
                <button
                  onClick={() => setSuggestionModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-neon-blue bg-neon-blue/15 px-3 py-2 rounded-lg hover:bg-neon-blue/25 transition-colors"
                >
                  Write Suggestion
                </button>
              )}
            </TaskCard>
          </div>
        )}
      </div>

      {/* Nickname modal */}
      <ModalShell
        isOpen={!!nicknameModal}
        onClose={() => setNicknameModal(null)}
        title={nicknameModal === 'telegram' ? 'Enter your Telegram username' : 'Enter your Facebook name'}
        icon={<img src={nicknameModal === 'telegram' ? TELEGRAM_ICON : FACEBOOK_ICON_URL} alt="icon" className="w-5 h-5 rounded object-cover" />}
      >
        <input
          type="text"
          value={nicknameValue}
          onChange={(e) => { setNicknameValue(e.target.value); setNicknameError(false); }}
          placeholder={nicknameModal === 'telegram' ? 'e.g. @your_username' : 'e.g. Your Facebook name'}
          className={`w-full bg-dark-card2 rounded-xl border px-3 py-3 text-sm text-white outline-none ${nicknameError ? 'border-neon-red' : 'border-dark-border'}`}
        />
        {nicknameError && <p className="text-[11px] text-neon-red mt-1.5">Please enter a valid nickname (at least 2 characters).</p>}
        <button
          onClick={nicknameModal === 'telegram' ? submitTelegramNickname : submitFacebookNickname}
          className="w-full mt-3 bg-neon-green text-dark-bg font-bold py-3 rounded-xl transition-all active:scale-95 hover:bg-neon-green/90 neon-green-glow flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={18} /> Confirm
        </button>
      </ModalShell>

      {/* External link modal */}
      <ExternalLinkModal
        isOpen={!!externalLink}
        onClose={() => setExternalLink(null)}
        url={externalLink?.url ?? ''}
        title={externalLink?.title ?? ''}
        description={externalLink?.description ?? ''}
        icon={externalLink?.icon}
      />

      {/* Advice modal */}
      <FeedbackModal
        isOpen={adviceModalOpen}
        onClose={() => setAdviceModalOpen(false)}
        title="Give us some advice"
        placeholder="Write your advice here (10-1000 characters)..."
        onSubmit={handleAdviceSubmit}
      />

      {/* Suggestion modal */}
      <FeedbackModal
        isOpen={suggestionModalOpen}
        onClose={() => setSuggestionModalOpen(false)}
        title="আপনার মতে পরবর্তীতে কোন জিনিসটা যুক্ত করা উচিত?"
        placeholder="আপনার মতামত লিখুন (১০-১০০০ অক্ষর)..."
        onSubmit={handleSuggestionSubmit}
      />
    </div>
  );
}

function TaskCard({
  number,
  icon,
  title,
  rewardText,
  isDone,
  children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  rewardText: string;
  isDone: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-dark-card2 rounded-xl border p-3.5 transition-all ${isDone ? 'border-neon-green/40' : 'border-dark-border'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDone ? 'bg-neon-green/15' : 'bg-dark-bg'}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">{title}</p>
            <span className="text-[10px] font-bold bg-neon-gold/15 text-neon-gold px-1.5 py-0.5 rounded-full shrink-0">
              {rewardText}
            </span>
          </div>
          <div className="mt-2.5">{children}</div>
        </div>
        <span className="text-[10px] text-gray-600 font-bold shrink-0">#{number}</span>
      </div>
    </div>
  );
}

function CompletedBadge() {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-neon-green bg-neon-green/10 px-3 py-2 rounded-lg w-fit">
      <CheckCircle2 size={14} /> Complete
    </div>
  );
}

function ProcessingBadge() {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-neon-gold bg-neon-gold/10 px-3 py-2 rounded-lg w-fit">
      <Loader2 size={14} className="animate-spin" /> Processing...
    </div>
  );
}

function FeedbackModal({
  isOpen,
  onClose,
  title,
  placeholder,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  placeholder: string;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const charCount = text.length;
  const isValid = charCount >= 10 && charCount <= 1000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      await onSubmit(text);
      setText('');
    } catch {
      setError(true);
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={<MessageSquare size={20} className="text-neon-blue" />}
    >
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="w-full bg-dark-card2 rounded-xl border border-dark-border px-3 py-3 text-sm text-white outline-none resize-none"
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-[11px] ${isValid ? 'text-gray-500' : 'text-neon-red'}`}>
            {charCount}/1000 characters
          </span>
          {error && <span className="text-[11px] text-neon-red">Failed to submit. Try again.</span>}
        </div>
        <button
          type="submit"
          disabled={!isValid || submitting}
          className="w-full mt-3 bg-neon-green text-dark-bg font-bold py-3 rounded-xl transition-all active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Submitting...
            </>
          ) : (
            <>
              <Send size={18} /> Submit
            </>
          )}
        </button>
      </form>
    </ModalShell>
  );
}
