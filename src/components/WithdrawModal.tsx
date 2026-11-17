import { useState, useEffect } from 'react';
import { CheckCircle2, X, AlertCircle, Info, Lock, Network } from 'lucide-react';
import { openModal, closeModal } from '@/hooks/useModalState';
import { withdrawMethods } from '@/data/games';
import PaymentLogo from '@/components/PaymentLogo';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { addTransaction } from '@/lib/localStorage';
import { db, ref, get, push, set } from '@/lib/firebase';
import type { DepositMethod } from '@/types';

interface WithdrawModalProps {
  isOpen: boolean;
  balance: number;
  onClose: () => void;
  onWithdraw: (amount: number) => void;
}

const UID_METHODS = ['binance', 'bybit', 'bitget'];
const MOBILE_METHODS = ['bkash', 'nagad', 'rocket', 'upay'];
const CRYPTO_METHODS = ['binance', 'bybit', 'bitget', 'usdt'];
const USD_RATE = 128;

export default function WithdrawModal({ isOpen, balance, onClose, onWithdraw }: WithdrawModalProps) {
  const { user, deductBalance } = useAuth();
  const { t, bn } = useLanguage();
  const [step, setStep] = useState<'method' | 'amount' | 'network' | 'done'>('method');
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<'bsc' | 'apt' | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountError, setAccountError] = useState(false);
  const [requiredTurnover, setRequiredTurnover] = useState<number>(0);
  const [turnoverLoading, setTurnoverLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    openModal();
    (async () => {
      let target = user?.turnoverTarget ?? null;
      if (target == null) {
        const snap = await get(ref(db, 'game_settings/turnover'));
        target = snap.exists() ? (snap.val().target ?? 0) : 0;
      }
      setRequiredTurnover(typeof target === 'number' ? target : 0);
      setTurnoverLoading(false);
    })();
    return () => closeModal();
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTurnover = user?.turnover ?? 0;
  const turnoverMet = currentTurnover >= requiredTurnover;

  const isUsdt = selectedMethod?.id === 'usdt';
  const isUidMethod = selectedMethod ? UID_METHODS.includes(selectedMethod.id) : false;
  const isMobileMethod = selectedMethod ? MOBILE_METHODS.includes(selectedMethod.id) : false;
  const isCryptoMethod = selectedMethod ? CRYPTO_METHODS.includes(selectedMethod.id) : false;
  const usdEquivalent = amount > 0 ? (amount / USD_RATE).toFixed(2) : '0.00';
  const cryptoEquivalent = isUsdt ? `≈ USDT ${usdEquivalent}` : `≈ ${usdEquivalent}`;

  const getFieldLabel = () => {
    if (isUidMethod) return 'UID';
    if (isMobileMethod) return 'Mobile Number';
    if (isUsdt) return 'Withdrawal Address';
    return 'Account Number';
  };

  const getFieldPlaceholder = () => {
    if (isUidMethod) return '8-13 digit UID';
    if (isMobileMethod) return '01XXXXXXXXX';
    if (isUsdt) return 'Enter your wallet address';
    return '01XXXXXXXXX';
  };

  const validateAccount = (val: string): boolean => {
    if (!val.trim()) return false;
    if (isUidMethod) return /^\d{8,13}$/.test(val);
    if (isMobileMethod) return /^01[0-9]{9}$/.test(val);
    if (isUsdt) return val.trim().length > 0;
    return val.trim().length > 0;
  };

  const handleAccountChange = (val: string) => {
    if (isUidMethod || isMobileMethod) {
      const digits = val.replace(/[^0-9]/g, '').slice(0, 13);
      setAccountNumber(digits);
    } else {
      setAccountNumber(val);
    }
    setAccountError(false);
  };

  const handleClose = () => {
    setStep('method');
    setSelectedMethod(null);
    setSelectedNetwork(null);
    setAmount(0);
    setAccountNumber('');
    setAccountError(false);
    onClose();
  };

  const handleMethodSelect = (method: DepositMethod) => {
    setSelectedMethod(method);
    setSelectedNetwork(null);
    setAccountNumber('');
    setAccountError(false);
  };

  const canProceedFromMethod = () => {
    if (!selectedMethod) return false;
    if (isUsdt) return selectedNetwork !== null;
    return validateAccount(accountNumber);
  };

  const handleWithdraw = async () => {
    if (amount < 200 || amount > balance) return;
    if (!turnoverMet) return;
    if (!validateAccount(accountNumber)) {
      setAccountError(true);
      return;
    }
    if (user && selectedMethod) {
      const wdRef = push(ref(db, 'withdraw_requests'));
      await set(wdRef, {
        userId: user.uid,
        userName: user.name,
        userPhone: user.phone,
        method: selectedMethod.id,
        network: isUsdt ? selectedNetwork : null,
        amount: amount,
        accountNumber: accountNumber,
        status: 'pending',
        createdAt: Date.now(),
      });
      await deductBalance(amount);
    }
    if (selectedMethod) {
      addTransaction({ id: `${Date.now()}-wd`, type: 'withdraw', amount, method: selectedMethod.id, timestamp: Date.now() });
    }
    onWithdraw(amount);
    setStep('done');
    setTimeout(() => handleClose(), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[9998] bg-white flex items-end sm:items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-gray-200 animate-fade-in-up max-h-[calc(100vh-1rem)] mb-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h3 className="font-display text-lg font-bold text-gray-900">
            {step === 'done' ? 'Success' : step === 'network' ? 'Select Network' : 'Withdraw'}
          </h3>
          <button onClick={handleClose} className="text-gray-600 hover:text-gray-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Balance display */}
        <div className="px-4 pt-4">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 flex items-center justify-between">
            <span className="text-xs text-gray-600">Available Balance</span>
            <span className="font-display text-lg font-bold text-neon-gold">
              ৳{Math.round(balance).toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {/* Turnover warning */}
        {!turnoverLoading && !turnoverMet && (
          <div className="px-4 pt-3">
            <div className="bg-neon-red/10 border border-neon-red/30 rounded-xl p-3 flex items-start gap-2">
              <Lock size={16} className="text-neon-red shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-neon-red">Turnover requirement not met</p>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  You must play ৳{bn(requiredTurnover.toLocaleString())} more in total bets to unlock withdrawals.
                  Current: ৳{bn(currentTurnover.toLocaleString())} / ৳{bn(requiredTurnover.toLocaleString())}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step: Method */}
        {step === 'method' && (
          <div className="p-4 animate-fade-in-up">
            <p className="text-xs text-gray-600 font-semibold mb-3">Select withdrawal method</p>
            <div className="grid grid-cols-3 gap-2.5">
              {withdrawMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => handleMethodSelect(method)}
                  className={`relative bg-gray-50 border rounded-xl p-3 flex flex-col items-center gap-2 transition-all active:scale-95 ${
                    selectedMethod?.id === method.id
                      ? 'border-neon-green neon-green-glow'
                      : 'border-gray-200 hover:border-gray-600'
                  }`}
                >
                  <PaymentLogo methodId={method.id} size={40} />
                  <span className="text-xs font-semibold text-gray-900 text-center leading-tight">
                    {t(`payment.${method.id}`)}
                  </span>
                  {selectedMethod?.id === method.id && (
                    <CheckCircle2 size={16} className="text-neon-green absolute top-1.5 right-1.5" />
                  )}
                </button>
              ))}
            </div>

            {selectedMethod && !isUsdt && (
              <div className="mt-4 animate-fade-in-up">
                <p className="text-xs text-gray-600 font-semibold mb-2">
                  {getFieldLabel()}
                </p>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  placeholder={getFieldPlaceholder()}
                  className={`w-full bg-gray-50 rounded-xl border px-3 py-3 text-gray-900 font-semibold outline-none text-sm transition-colors ${
                    accountError ? 'border-neon-red' : 'border-gray-200 focus:border-neon-green/40'
                  }`}
                />
                {accountError && (
                  <p className="text-xs text-neon-red flex items-center gap-1.5 mt-1.5">
                    <AlertCircle size={13} />
                    {isUidMethod
                      ? 'UID must be 8-13 digits'
                      : isMobileMethod
                        ? 'Enter a valid 11-digit mobile number'
                        : 'Please enter a valid value'}
                  </p>
                )}
                {isUidMethod && (
                  <p className="text-[11px] text-gray-600 mt-1">Enter your 8-13 digit UID</p>
                )}
                {isMobileMethod && (
                  <p className="text-[11px] text-gray-600 mt-1">Enter your 11-digit mobile number</p>
                )}
              </div>
            )}

            {selectedMethod && isUsdt && (
              <div className="mt-4 animate-fade-in-up">
                <div className="flex items-center gap-2 mb-3">
                  <Network size={18} className="text-neon-blue" />
                  <p className="text-sm text-gray-700 font-semibold">Select network</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => setSelectedNetwork('apt')}
                    className={`bg-gray-50 border rounded-xl p-3 flex flex-col items-center gap-1 transition-all active:scale-95 ${
                      selectedNetwork === 'apt' ? 'border-neon-green' : 'border-gray-200 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-base font-bold text-gray-900">APT</span>
                    <span className="text-xs text-gray-600">Aptos</span>
                  </button>
                  <button
                    onClick={() => setSelectedNetwork('bsc')}
                    className={`bg-gray-50 border rounded-xl p-3 flex flex-col items-center gap-1 transition-all active:scale-95 ${
                      selectedNetwork === 'bsc' ? 'border-neon-green' : 'border-gray-200 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-base font-bold text-gray-900">BSC</span>
                    <span className="text-xs text-gray-600">Bep20</span>
                  </button>
                </div>
                {selectedNetwork && (
                  <div className="animate-fade-in-up">
                    <p className="text-xs text-gray-600 font-semibold mb-2">Withdrawal Address</p>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => handleAccountChange(e.target.value)}
                      placeholder="Enter your wallet address"
                      className={`w-full bg-gray-50 rounded-xl border px-3 py-3 text-gray-900 font-semibold outline-none text-sm transition-colors ${
                        accountError ? 'border-neon-red' : 'border-gray-200 focus:border-neon-green/40'
                      }`}
                    />
                    {accountError && (
                      <p className="text-xs text-neon-red flex items-center gap-1.5 mt-1.5">
                        <AlertCircle size={13} /> Please enter a valid withdrawal address
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedMethod && (
              <div className="mt-4 animate-fade-in-up">
                <p className="text-xs text-gray-600 font-semibold mb-2 mt-4">Withdrawal amount</p>
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
                <div className="flex gap-2 mt-2">
                  {[200, 500, 1000, Math.min(2000, Math.floor(balance))].filter((v, i, arr) => arr.indexOf(v) === i).map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmount(amt)}
                      className="flex-1 bg-gray-50 hover:bg-gray-200 text-xs text-gray-700 font-semibold py-1.5 rounded-lg transition-colors"
                    >
                      ৳{bn(amt)}
                    </button>
                  ))}
                </div>

                {amount > 0 && amount < 200 && (
                  <p className="text-xs text-neon-red font-semibold mt-2 flex items-center gap-1.5">
                    <AlertCircle size={13} /> সর্বনিম্ন উইথড্র ২০০ টাকা
                  </p>
                )}
                {!(amount > 0 && amount < 200) && (
                  <p className="text-xs text-neon-gold/90 font-semibold mt-2 flex items-center gap-1.5">
                    <Info size={13} /> সর্বনিম্ন উইথড্র এমাউন্ট 200
                  </p>
                )}
                {amount > balance && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-neon-red">
                    <AlertCircle size={14} />
                    Amount exceeds available balance
                  </div>
                )}
                {isCryptoMethod && amount > 0 && (
                  <p className="text-xs text-neon-blue font-semibold mt-2">
                    {cryptoEquivalent}
                  </p>
                )}

                <button
                  onClick={handleWithdraw}
                  disabled={amount < 200 || amount > balance || !canProceedFromMethod() || !turnoverMet}
                  className="w-full mt-4 bg-neon-green text-dark-bg font-bold py-3 rounded-xl transition-all active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 disabled:cursor-not-allowed neon-green-glow"
                >
                  {turnoverMet ? `Withdraw ৳${amount || 0}` : 'Withdrawal Locked'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="p-8 text-center animate-scale-in">
            <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <CheckCircle2 size={40} className="text-neon-green" />
            </div>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-1">
              Withdrawal Requested!
            </h3>
            <p className="text-sm text-gray-600">
              ৳{bn(amount.toLocaleString())} will be sent to your {t(`payment.${selectedMethod?.id}`)} {isUsdt ? 'wallet' : 'account'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
