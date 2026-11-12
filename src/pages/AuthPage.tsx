import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, Phone, Gift, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEmail = (value: string) => value.includes('@');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Please enter your phone number or email');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(identifier, password);
      } else {
        await signup(identifier, password, referralCode);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      if (message.includes('invalid-credential') || message.includes('wrong-password')) {
        setError('Invalid phone/email or password');
      } else if (message.includes('email-already-in-use')) {
        setError('This account is already registered');
      } else if (message.includes('invalid-email')) {
        setError('Invalid email or phone number');
      } else if (message.includes('network')) {
        setError('Network error — check your connection');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setError('');
    setPassword('');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#004d4d] px-5 py-10 text-white">
      <img
        src="https://i.postimg.cc/nLvNfk65/1793718626744.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-20"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#003c45]/90 via-[#005b59]/90 to-[#003e42]/95" />

      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-md flex-col items-center">
        <div className="mt-5 flex flex-col items-center">
          <img
            src="https://i.postimg.cc/Hs6mwS6P/Chat-GPT-Image-Sep-25-2026-02-40-49-PM.png"
            alt="24XBET"
            className="h-24 w-24 rounded-full border-4 border-[#f7c515] object-cover shadow-[0_0_25px_rgba(255,196,0,0.35)]"
          />
          <h1 className="mt-4 font-display text-3xl font-black tracking-wide text-[#ffc400]">24XBET</h1>
          <h2 className="mt-5 text-2xl font-bold text-[#ffc400]">
            {mode === 'login' ? 'Login' : 'Register'}
          </h2>
          <p className="mt-2 text-sm text-white/85">
            {mode === 'login' ? 'Don’t have an account? ' : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold text-[#42f0ca] underline underline-offset-2"
            >
              {mode === 'login' ? 'Sign up' : 'Login'}
            </button>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 w-full space-y-3">
          <div className="flex items-center rounded-2xl border border-[#159f99] bg-[#00333f]/90 px-4 py-3.5 shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
            {isEmail(identifier) ? <Mail size={21} className="mr-3 shrink-0 text-[#36f0cc]" /> : <Phone size={21} className="mr-3 shrink-0 text-[#36f0cc]" />}
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Phone number or email"
              required
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#55c5b5]"
            />
          </div>

          <div className="flex items-center rounded-2xl border border-[#159f99] bg-[#00333f]/90 px-4 py-3.5 shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
            <Lock size={21} className="mr-3 shrink-0 text-[#36f0cc]" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              required
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#55c5b5]"
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-2 text-[#36f0cc]">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {mode === 'signup' && (
            <>
              <div className="flex items-center rounded-2xl border border-[#159f99] bg-[#00333f]/90 px-4 py-3.5">
                <Gift size={21} className="mr-3 shrink-0 text-[#36f0cc]" />
                <input
                  type="text"
                  value={referralCode}
                  onChange={(event) => setReferralCode(event.target.value)}
                  placeholder="Referral code (optional)"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#55c5b5]"
                />
              </div>
              <div className="flex items-start gap-3 px-1 text-left text-xs leading-5 text-white/90">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#ffc400] bg-[#ffc400] text-[#00504d]">
                  <Check size={16} strokeWidth={3} />
                </span>
                <span>I am over 18 and accept the Terms, Privacy Policy and Betting Rules.</span>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-xs text-red-100">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#ffe36b] bg-gradient-to-b from-[#ffd52d] to-[#f3a900] py-3.5 text-lg font-bold text-[#8d4100] shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-transform active:scale-[0.98] disabled:opacity-60">
            {loading ? <><Loader2 size={19} className="animate-spin" /> {t('common.loading')}</> : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <p className="mt-auto pt-10 text-center text-[11px] text-white/55">Secure account access</p>
      </div>
    </div>
  );
}
