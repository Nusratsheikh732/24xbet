import { useState, useEffect } from 'react';
import { CheckCircle2, Copy, X, Phone, AlertCircle, Info, Network, User } from 'lucide-react';
import { openModal, closeModal } from '@/hooks/useModalState';
import { depositMethods } from '@/data/games';
import PaymentLogo from '@/components/PaymentLogo';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { addTransaction } from '@/lib/localStorage';
import { db, ref, get, onValue, push, set, update } from '@/lib/firebase';
import type { DepositMethod } from '@/types';
import { requestNotificationPermission, hasAskedPermission, markPermissionAsked, showNotification, getBrowserPermission } from '@/lib/notifications';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositComplete: (amount: number) => void;
}

const DEFAULT_PAYMENT_NUMBER = '01907262606';

const USDT_WALLETS: Record<string, string> = {
  bsc: '0x8d57dfe1fa68ba7cd0236dc88ba45554742f6fe3',
  apt: '0x4a7625fb7002bf0d93094cd9b867958d959af91272611e6f6f34aa54c06b5d66',
};

const BONUS_METHODS: Record<string, number> = {
  binance: 5,
  bybit: 5,
  bitget: 5,
  usdt: 5,
};

const NICKNAME_METHODS = ['binance', 'bybit', 'bitget'];
const CRYPTO_METHODS = ['binance', 'bybit', 'bitget', 'usdt'];
const USD_RATE = 128;

export default function DepositModal({ isOpen, onClose, onDepositComplete }: DepositModalProps) {
  const { user } = useAuth();
  const { t, bn } = useLanguage();
  const [step, setStep] = useState<'method' | 'amount' | 'network' | 'send' | 'trxid' | 'done'>('method');
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<'bsc' | 'apt' | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [includeBonus, setIncludeBonus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [trxId, setTrxId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [trxError, setTrxError] = useState(false);
  const [paymentNumbers, setPaymentNumbers] = useState<Record<string, string>>({});
  const [paymentInstructions, setPaymentInstructions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    openModal();
    return () => closeModal();
  }, [isOpen]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = onValue(
        ref(db, 'game_settings/payment_numbers'),
        (snap) => {
          if (snap.exists() && snap.val().numbers) {
            setPaymentNumbers(snap.val().numbers);
          }
          if (snap.exists() && snap.val().instructions) {
            setPaymentInstructions(snap.val().instructions);
          }
        },
        () => {
          // Database node missing or inaccessible — defaults are used
        },
      );
    } catch {
      // Firestore connection error — defaults are used
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  if (!isOpen) return null;

  const getPaymentNumber = (methodId: string) =>
    paymentNumbers[methodId]?.trim() || DEFAULT_PAYMENT_NUMBER;

  const getPaymentInstruction = (methodId: string) =>
    paymentInstructions[methodId]?.trim() || '';

  const isUsdt = selectedMethod?.id === 'usdt';
  const isNicknameMethod = selectedMethod ? NICKNAME_METHODS.includes(selectedMethod.id) : false;
  const isCryptoMethod = selectedMethod ? CRYPTO_METHODS.includes(selectedMethod.id) : false;
  const bonusPercent = selectedMethod ? BONUS_METHODS[selectedMethod.id] : 0;
  const bonusAmount = includeBonus && bonusPercent > 0 ? Math.floor((amount * bonusPercent) / 100) : 0;
  const usdEquivalent = amount > 0 ? (amount / USD_RATE).toFixed(2) : '0.00';
  const cryptoEquivalent = isUsdt ? `≈ USDT ${usdEquivalent}` : `≈ ${usdEquivalent}`;

  const handleMethodSelect = (method: DepositMethod) => {
    setSelectedMethod(method);
    setSelectedNetwork(null);
    setStep('amount');
  };

  const handleAmountNext = () => {
    if (amount < 200) return;
    if (isUsdt) {
      setStep('network');
    } else {
      setStep('send');
    }
  };

  const handleNetworkSelect = (net: 'bsc' | 'apt') => {
    setSelectedNetwork(net);
    setStep('send');
  };

  const handleCopy = () => {
    const text = isUsdt && selectedNetwork
      ? USDT_WALLETS[selectedNetwork]
      : selectedMethod
        ? getPaymentNumber(selectedMethod.id)
        : DEFAULT_PAYMENT_NUMBER;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaymentComplete = () => {
    setStep('trxid');
  };

  const handleTrxIdSubmit = async () => {
    const trimmed = trxId.trim();
    if (!trimmed) {
      setTrxError(true);
      return;
    }
    if (!isUsdt && !isNicknameMethod && !/^01[0-9]{9}$/.test(trimmed)) {
      setTrxError(true);
      return;
    }
    if (isNicknameMethod && trimmed.length < 2) {
      setTrxError(true);
      return;
    }
    setSubmitting(true);

    if (user) {
      const alreadyAsked = await hasAskedPermission(user.uid);
      if (!alreadyAsked) {
        const currentPerm = getBrowserPermission();
        if (currentPerm === 'default') {
          const result = await requestNotificationPermission();
          if (result === 'granted') {
            showNotification('24xbet', 'Notifications enabled! You will be notified about your deposit and withdrawal updates.');
          }
        }
        await markPermissionAsked(user.uid);
      }
    }

    if (user && selectedMethod) {
      const depositRef = push(ref(db, 'deposit_requests'));
      await set(depositRef, {
        userId: user.uid,
        userName: user.name,
        userPhone: user.phone,
        method: selectedMethod.id,
        network: isUsdt ? selectedNetwork : null,
        amount: amount,
        bonus: bonusAmount,
        status: 'pending',
        senderNumber: trimmed,
        trxId: trimmed,
        createdAt: Date.now(),
      });
    }
    if (selectedMethod) {
      addTransaction({ id: `${Date.now()}-dep`, type: 'deposit', amount, method: selectedMethod.id, timestamp: Date.now() });
    }
    onDepositComplete(amount);

    // Auto-complete the deposit airdrop task
    if (user) {
      try {
        const airdropSnap = await get(ref(db, 'airdrop_tasks/' + user.uid));
        const existing = airdropSnap.exists() ? new Set<string>(airdropSnap.val().completed ?? []) : new Set<string>();
        if (!existing.has('submit_deposit')) {
          existing.add('submit_deposit');
          await update(ref(db, 'airdrop_tasks/' + user.uid), {
            completed: Array.from(existing),
            updatedAt: Date.now(),
          });
        }
      } catch {
        // ignore — airdrop task completion is best-effort
      }
    }

    setSubmitting(false);
    setStep('done');
    setTimeout(() => {
      handleClose();
    }, 2500);
  };

  const handleClose = () => {
    setStep('method');
    setSelectedMethod(null);
    setSelectedNetwork(null);
    setAmount(0);
    setIncludeBonus(false);
    setCopied(false);
    setTrxId('');
    setTrxError(false);
    setSubmitting(false);
    onClose();
  };

  const displayAddress = isUsdt && selectedNetwork ? USDT_WALLETS[selectedNetwork] : null;

  return (
    <div
      className="fixed inset-0 z-[9998] bg-white flex items-end sm:items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-gray-200 animate-fade-in-up max-h-[calc(90vh-7rem)] mb-28 sm:mb-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h3 className="font-display text-lg font-bold text-gray-900">
            {step === 'done' ? t('deposit.success') : step === 'trxid' ? t('deposit.verifyPayment') : step === 'network' ? 'Select Network' : t('header.deposit')}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step: Method selection */}
        {step === 'method' && (
          <div className="p-4 animate-fade-in-up">
            <p className="text-xs text-gray-600 font-semibold mb-3">{t('deposit.selectMethod')}</p>
            <div className="grid grid-cols-3 gap-2.5">
              {depositMethods.map((method) => {
                const bonus = BONUS_METHODS[method.id];
                return (
                  <button
                    key={method.id}
                    onClick={() => handleMethodSelect(method)}
                    className="relative bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-2 hover:border-neon-green/40 transition-all active:scale-95"
                  >
                    {bonus > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-neon-green text-dark-bg text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        +{bonus}% Bonus
                      </span>
                    )}
                    <PaymentLogo methodId={method.id} size={38} />
                    <span className="text-xs font-semibold text-gray-900 text-center leading-tight">{t(`payment.${method.id}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step: Amount entry */}
        {step === 'amount' && selectedMethod && (
          <div className="p-4 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <PaymentLogo methodId={selectedMethod.id} size={40} />
              <span className="text-sm font-semibold text-gray-900">{t(`payment.${selectedMethod.id}`)}</span>
              {bonusPercent > 0 && (
                <span className="ml-auto bg-neon-green/15 text-neon-green text-xs font-bold px-2 py-1 rounded-full">
                  +{bonusPercent}% Bonus
                </span>
              )}
            </div>

            <p className="text-xs text-gray-600 font-semibold mb-2">{t('deposit.enterAmount')}</p>
            <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-3 py-3">
              <span className="text-neon-gold font-bold text-lg mr-1">৳</span>
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="bg-transparent text-gray-900 font-bold w-full outline-none text-lg"
              />
            </div>
            {amount > 0 && amount < 200 && (
              <p className="text-xs text-neon-red font-semibold mt-2 flex items-center gap-1.5">
                <AlertCircle size={13} /> সর্বনিম্ন ডিপোজিট ২০০ টাকা
              </p>
            )}
            {!(amount > 0 && amount < 200) && (
              <p className="text-xs text-neon-gold/90 font-semibold mt-2 flex items-center gap-1.5">
                <Info size={13} /> সর্বনিম্ন ডিপোজিট অ্যামাউন্ট 200
              </p>
            )}
            {isCryptoMethod && amount > 0 && (
              <p className="text-xs text-neon-blue font-semibold mt-2">
                {cryptoEquivalent}
              </p>
            )}
            {bonusAmount > 0 && (
              <div className="bg-neon-green/10 border border-neon-green/20 rounded-xl p-2.5 mt-2 flex items-center justify-between">
                <span className="text-xs text-neon-green font-semibold">Extra Bonus (+{bonusPercent}%)</span>
                <span className="text-sm font-bold text-neon-green">+৳{bn(bonusAmount.toLocaleString())}</span>
              </div>
            )}
            <div className="flex gap-2 mt-2">
              {[200, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  className="flex-1 bg-gray-50 hover:bg-gray-200 text-xs text-gray-700 font-semibold py-1.5 rounded-lg transition-colors"
                >
                  ৳{bn(amt)}
                </button>
              ))}
            </div>

            {amount >= 200 && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                <p className="mb-2 text-xs font-semibold text-gray-700">Promotions</p>
                <button
                  type="button"
                  onClick={() => setIncludeBonus(true)}
                  className={`mb-2 flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                    includeBonus
                      ? 'border-neon-green/50 bg-neon-green/10'
                      : 'border-gray-200 bg-gray-50 hover:border-neon-green/30'
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${includeBonus ? 'border-neon-green' : 'border-gray-500'}`}>
                    {includeBonus && <span className="h-2 w-2 rounded-full bg-neon-green" />}
                  </span>
                  <span className="flex-1 text-xs font-semibold text-gray-900">বোনাস নিতে চাই</span>
                  <span className="text-xs font-bold text-neon-green">{bonusPercent > 0 ? `+${bonusPercent}%` : 'Bonus'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeBonus(false)}
                  className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                    !includeBonus
                      ? 'border-neon-gold/50 bg-neon-gold/5'
                      : 'border-gray-200 bg-gray-50 hover:border-neon-gold/30'
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${!includeBonus ? 'border-neon-gold' : 'border-gray-500'}`}>
                    {!includeBonus && <span className="h-2 w-2 rounded-full bg-neon-gold" />}
                  </span>
                  <span className="text-xs font-semibold text-gray-900">কোনো প্রমোশনে অংশ নেবো না</span>
                </button>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setStep('method')}
                className="flex-1 bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition-all hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleAmountNext}
                disabled={amount < 200}
                className="flex-[2] bg-neon-green text-dark-bg font-bold py-3 rounded-xl transition-all active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 disabled:cursor-not-allowed neon-green-glow"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step: Network selection (USDT only) */}
        {step === 'network' && selectedMethod && (
          <div className="p-4 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <PaymentLogo methodId={selectedMethod.id} size={40} />
              <span className="text-sm font-semibold text-gray-900">{t(`payment.${selectedMethod.id}`)}</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Network size={18} className="text-neon-blue" />
              <p className="text-sm text-gray-700 font-semibold">Select a network to send USDT</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleNetworkSelect('bsc')}
                className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-neon-green/40 transition-all active:scale-95"
              >
                <span className="text-lg font-bold text-gray-900">BSC</span>
                <span className="text-xs text-gray-600">Bep20</span>
              </button>
              <button
                onClick={() => handleNetworkSelect('apt')}
                className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-neon-green/40 transition-all active:scale-95"
              >
                <span className="text-lg font-bold text-gray-900">APT</span>
                <span className="text-xs text-gray-600">Aptos</span>
              </button>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setStep('amount')}
                className="flex-1 bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition-all hover:bg-gray-200"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step: Send money */}
        {step === 'send' && selectedMethod && (
          <div className="p-4 animate-fade-in-up">
            <div className="text-center mb-4">
              <div className="flex justify-center mb-2">
                <PaymentLogo methodId={selectedMethod.id} size={56} />
              </div>
              <p className="text-sm text-gray-600">{t('deposit.sendMoney')} {t(`payment.${selectedMethod.id}`)}</p>
              <p className="font-display text-2xl font-bold text-neon-gold mt-1">
                ৳{bn(amount.toLocaleString())}
              </p>
              {isCryptoMethod && (
                <p className="text-xs text-neon-blue font-semibold mt-1">
                  {cryptoEquivalent}
                </p>
              )}
              {bonusAmount > 0 && (
                <p className="text-xs text-neon-green font-semibold mt-1">
                  +৳{bn(bonusAmount.toLocaleString())} bonus included
                </p>
              )}
            </div>

            {displayAddress ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
                <p className="text-xs text-gray-600 font-semibold mb-1">
                  Send USDT to ({selectedNetwork === 'bsc' ? 'BSC / Bep20' : 'APT / Aptos'})
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-gray-900 tracking-wide break-all">
                    {displayAddress}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-neon-green/10 rounded-lg text-neon-green hover:bg-neon-green/20 transition-all active:scale-90 shrink-0"
                  >
                    {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
                <p className="text-xs text-gray-600 font-semibold mb-2">
                  {t('deposit.sendTo').replace('{method}', t(`payment.${selectedMethod.id}`))}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-bold text-gray-900 tracking-wider">
                    {getPaymentNumber(selectedMethod.id)}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-neon-green/10 rounded-lg text-neon-green hover:bg-neon-green/20 transition-all active:scale-90"
                  >
                    {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            )}

            {getPaymentInstruction(selectedMethod.id) && !displayAddress && (
              <div className="bg-neon-gold/5 border border-neon-gold/20 rounded-xl p-3 mb-4">
                <p className="text-xs text-neon-gold/90 leading-relaxed whitespace-pre-wrap">
                  {getPaymentInstruction(selectedMethod.id)}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => isUsdt ? setStep('network') : setStep('amount')}
                className="flex-1 bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition-all hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handlePaymentComplete}
                className="flex-[2] bg-neon-green text-dark-bg font-bold py-3 rounded-xl transition-all active:scale-95 hover:bg-neon-green/90 neon-green-glow"
              >
                {t('deposit.paymentComplete')}
              </button>
            </div>
          </div>
        )}

        {/* Step: Sender number / Trx ID entry */}
        {step === 'trxid' && selectedMethod && (
          <div className="p-4 animate-fade-in-up">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-neon-green/10 rounded-full flex items-center justify-center mx-auto mb-3">
                {isUsdt ? <Network size={28} className="text-neon-green" /> : isNicknameMethod ? <User size={28} className="text-neon-green" /> : <Phone size={28} className="text-neon-green" />}
              </div>
              <h4 className="font-display text-lg font-bold text-gray-900 mb-1">
                {isUsdt ? 'Transaction ID (Trx ID)' : isNicknameMethod ? 'Your Nickname' : 'প্রেরকের নাম্বার'}
              </h4>
              <p className="text-xs text-gray-600">
                {isUsdt
                  ? 'Enter the Transaction ID from your USDT transfer'
                  : isNicknameMethod
                    ? 'Enter your account nickname from which you sent the funds'
                    : 'যে নাম্বার থেকে টাকা পাঠিয়েছেন সে নাম্বারটি দেন'}
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Amount</span>
                <span className="font-bold text-neon-gold">৳{bn(amount.toLocaleString())}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-600">Method</span>
                <span className="font-bold text-gray-900">{t(`payment.${selectedMethod.id}`)}</span>
              </div>
              {isUsdt && selectedNetwork && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-600">Network</span>
                  <span className="font-bold text-gray-900">
                    {selectedNetwork === 'bsc' ? 'BSC (Bep20)' : 'APT (Aptos)'}
                  </span>
                </div>
              )}
              {bonusAmount > 0 && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-600">Bonus</span>
                  <span className="font-bold text-neon-green">+৳{bn(bonusAmount.toLocaleString())}</span>
                </div>
              )}
              {isCryptoMethod && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-600">≈ Equivalent</span>
                  <span className="font-bold text-neon-blue">{cryptoEquivalent}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-600 font-semibold mb-2">
              {isUsdt ? 'Transaction ID' : isNicknameMethod ? 'Enter your nickname' : 'যে নাম্বার থেকে টাকা পাঠিয়েছেন সে নাম্বারটি দেন'}
            </p>
            <div className={`flex items-center bg-gray-50 rounded-xl border px-4 py-3 transition-colors ${
              trxError ? 'border-neon-red' : 'border-gray-200 focus:border-neon-green/40'
            }`}>
              {!isUsdt && !isNicknameMethod && <span className="text-neon-gold font-bold mr-2 shrink-0">+88</span>}
              <input
                type="text"
                value={trxId}
                onChange={(e) => {
                  const val = isUsdt
                    ? e.target.value.trim()
                    : isNicknameMethod
                      ? e.target.value.trim().slice(0, 50)
                      : e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                  setTrxId(val);
                  setTrxError(false);
                }}
                placeholder={isUsdt ? 'e.g. 0x1a2b3c... or TrxID' : isNicknameMethod ? 'Enter your account nickname' : 'যেমন 01903242402'}
                className={`w-full bg-transparent text-gray-900 font-semibold outline-none text-base ${
                  trxError ? 'text-neon-red' : ''
                }`}
              />
            </div>
            {trxError && (
              <p className="text-xs text-neon-red flex items-center gap-1.5 mt-2">
                <AlertCircle size={14} />
                {isUsdt ? 'Please enter a valid Transaction ID' : isNicknameMethod ? 'Please enter your nickname (min 2 characters)' : 'সঠিক মোবাইল নাম্বার দিন (যেমন 01903242402)'}
              </p>
            )}

            <div className="bg-neon-blue/5 border border-neon-blue/20 rounded-xl p-3 mt-3 mb-4">
              <p className="text-xs text-neon-blue/80">
                Your deposit will be marked as <span className="font-bold">Pending Verification</span>.
                The admin will review and approve it shortly.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => isUsdt ? setStep('send') : setStep('send')}
                className="flex-1 bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition-all hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleTrxIdSubmit}
                disabled={submitting}
                className="flex-[2] bg-neon-green text-dark-bg font-bold py-3 rounded-xl transition-all active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
              >
                {submitting ? t('deposit.processing') : t('deposit.submitVerification')}
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="p-8 text-center animate-scale-in">
            <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <CheckCircle2 size={40} className="text-neon-green" />
            </div>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-1">
              {t('deposit.depositSubmitted')}
            </h3>
            <p className="text-sm text-gray-600">
              ৳{bn(amount.toLocaleString())} {t('deposit.pendingVerifyMsg')}
            </p>
            {bonusAmount > 0 && (
              <p className="text-xs text-neon-green font-semibold mt-1">
                +৳{bn(bonusAmount.toLocaleString())} bonus included
              </p>
            )}
            <p className="text-xs text-gray-600 mt-2">
              {isUsdt ? 'Trx ID' : isNicknameMethod ? 'Nickname' : 'প্রেরকের নাম্বার'}: <span className="font-semibold text-gray-700">{trxId}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
