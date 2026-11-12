import { useState, useEffect } from 'react';
import { ChevronLeft, Gift, Copy, CheckCircle2, Share2, Users, TrendingUp, Coins, Clock, Award, Target, Wallet, UserCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db, ref, onValue } from '@/lib/firebase';

const DEFAULT_REFERRAL_LINK = 'https://24xbet-mobile-gaming-veau.bolt.host';

interface ReferPageProps {
  onBack?: () => void;
}

export default function ReferPage({ onBack }: ReferPageProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [referralLink, setReferralLink] = useState(DEFAULT_REFERRAL_LINK);

  useEffect(() => {
    const unsub = onValue(ref(db, 'game_settings/referral'), (snap) => {
      if (snap.exists() && snap.val().link) {
        setReferralLink(snap.val().link);
      } else {
        setReferralLink(DEFAULT_REFERRAL_LINK);
      }
    });
    return () => unsub();
  }, []);

  const referralCode = user?.referralCode || '------';
  const pendingRefers = user?.pendingRefers || 0;
  const completedRefers = user?.completedRefers || 0;
  const referralEarnings = user?.referralEarnings || 0;
  const totalInvited = pendingRefers + completedRefers;
  const fullLink = `${referralLink}?ref=${referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(fullLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: '24xbet - Join & Earn',
        text: 'Join 24xbet and get bonus rewards! Use my referral code.',
        url: fullLink,
      });
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Header with back button */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Gift size={20} className="text-neon-green" />
          <h1 className="font-display text-lg font-bold text-gray-900">Refer & Earn</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Hero banner */}
        <div className="relative bg-gradient-to-br from-neon-green/10 via-white to-neon-gold/10 rounded-2xl border border-gray-200 p-6 text-center overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 30% 50%, #00ff88 0%, transparent 50%), radial-gradient(circle at 70% 50%, #ffd700 0%, transparent 50%)'
          }} />
          <div className="relative">
            <div className="w-16 h-16 bg-neon-green/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Gift size={32} className="text-neon-green" />
            </div>
            <h2 className="font-display text-2xl font-bold gradient-text-green">Refer & Earn</h2>
            <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
              Invite friends and earn up to <span className="font-bold text-neon-green">৳500</span> for each successful referral.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Condition: The referred friend must deposit at least <span className="font-bold text-neon-gold">৳1000</span>.
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="w-10 h-10 bg-neon-blue/15 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Users size={20} className="text-neon-blue" />
            </div>
            <p className="font-display text-2xl font-bold text-gray-900">{totalInvited}</p>
            <p className="text-[11px] text-gray-500 font-semibold">Total Invited</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="w-10 h-10 bg-neon-green/15 rounded-xl flex items-center justify-center mx-auto mb-2">
              <UserCheck size={20} className="text-neon-green" />
            </div>
            <p className="font-display text-2xl font-bold text-gray-900">{completedRefers}</p>
            <p className="text-[11px] text-gray-500 font-semibold">Successful Referrals</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="w-10 h-10 bg-neon-gold/15 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Coins size={20} className="text-neon-gold" />
            </div>
            <p className="font-display text-2xl font-bold text-gray-900">৳{referralEarnings}</p>
            <p className="text-[11px] text-gray-500 font-semibold">Total Earned</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Clock size={20} className="text-orange-500" />
            </div>
            <p className="font-display text-2xl font-bold text-gray-900">{pendingRefers}</p>
            <p className="text-[11px] text-gray-500 font-semibold">Pending</p>
          </div>
        </div>

        {/* Pending referrals banner */}
        {pendingRefers > 0 && (
          <div className="bg-neon-gold/10 border border-neon-gold/30 rounded-2xl p-4 flex items-start gap-3 animate-fade-in-up">
            <div className="w-10 h-10 bg-neon-gold/20 rounded-xl flex items-center justify-center shrink-0">
              <Clock size={20} className="text-neon-gold" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-neon-gold">{pendingRefers} Pending Referral{pendingRefers > 1 ? 's' : ''}</p>
              <p className="text-xs text-gray-600 mt-1">
                Your invited friends need to deposit at least ৳1000 for you to receive your bonus.
              </p>
            </div>
          </div>
        )}

        {/* Referral link sharing */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-2">Your Referral Code</p>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
              <span className="font-display text-lg font-bold text-neon-green tracking-wider">
                {referralCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 bg-neon-green/10 rounded-lg text-neon-green hover:bg-neon-green/20 transition-all active:scale-90"
              >
                {copiedCode ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 font-semibold mb-2">Referral Link</p>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
              <span className="text-xs text-gray-600 truncate flex-1 mr-2">{fullLink}</span>
              <button
                onClick={handleShare}
                className="p-2 bg-neon-blue/10 rounded-lg text-neon-blue hover:bg-neon-blue/20 transition-all active:scale-90"
              >
                <Share2 size={18} />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 bg-neon-green/10 text-neon-green font-bold text-sm py-2.5 rounded-xl hover:bg-neon-green/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {copied ? <><CheckCircle2 size={16} /> Copied!</> : <><Copy size={16} /> Copy Link</>}
            </button>
            <button
              onClick={handleShare}
              className="flex-1 bg-neon-blue/10 text-neon-blue font-bold text-sm py-2.5 rounded-xl hover:bg-neon-blue/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Share2 size={16} /> Share
            </button>
          </div>
        </div>

        {/* Reward breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-neon-gold" />
            <h3 className="font-display text-base font-bold text-gray-900">Reward Details</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="w-9 h-9 bg-neon-green/15 rounded-lg flex items-center justify-center shrink-0">
                <Target size={18} className="text-neon-green" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Deposit Condition</p>
                <p className="text-xs text-gray-500">Referred friend must deposit at least ৳1000</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="w-9 h-9 bg-neon-gold/15 rounded-lg flex items-center justify-center shrink-0">
                <Wallet size={18} className="text-neon-gold" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Your Reward</p>
                <p className="text-xs text-gray-500">Earn up to ৳500 per successful referral</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="w-9 h-9 bg-neon-blue/15 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-neon-blue" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Unlimited Referrals</p>
                <p className="text-xs text-gray-500">No limit — invite as many friends as you want</p>
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-display text-base font-bold text-gray-900 mb-4">How It Works</h3>
          <div className="space-y-4">
            {[
              { num: '1', title: 'Share your link', desc: 'Send your unique referral link to friends', icon: Share2, color: 'text-neon-green' },
              { num: '2', title: 'Friend joins', desc: 'They sign up using your referral code', icon: Users, color: 'text-neon-blue' },
              { num: '3', title: 'Friend deposits ৳1000', desc: 'When your friend deposits at least ৳1000, you earn up to ৳500', icon: Coins, color: 'text-neon-gold' },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 ${step.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-500">{step.desc}</p>
                  </div>
                  <span className="font-display text-2xl font-bold text-gray-200">{step.num}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
