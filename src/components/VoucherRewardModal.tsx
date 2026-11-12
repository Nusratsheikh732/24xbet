import { useEffect } from 'react';
import { Crown, X } from 'lucide-react';
import { openModal, closeModal } from '@/hooks/useModalState';

interface VoucherRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  deposited: number;
  target: number;
  onDeposit: () => void;
}

export default function VoucherRewardModal({ isOpen, onClose, deposited, target, onDeposit }: VoucherRewardModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    openModal();
    return () => closeModal();
  }, [isOpen]);

  if (!isOpen) return null;

  const progress = Math.min(deposited / target, 1) * 100;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div className="relative w-full max-w-sm pt-14" onClick={(e) => e.stopPropagation()}>
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
          <Crown size={84} className="fill-amber-300 text-amber-500 drop-shadow-lg" strokeWidth={1.5} />
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-2 -top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-white transition-transform active:scale-90"
        >
          <X size={20} />
        </button>

        <div className="animate-scale-in rounded-3xl bg-[#5b626c] px-5 pb-6 pt-4 text-white shadow-2xl">
          <div className="relative -mx-8 mb-4 flex h-12 items-center justify-center bg-gradient-to-r from-red-500 via-[#ff3b3b] to-red-500 shadow-md">
            <span className="font-display text-2xl font-bold">Rewards</span>
          </div>

          <p className="text-center text-base">Complete the task to claim your voucher</p>

          <div className="mt-4 rounded-full bg-[#2e333a] p-0.5">
            <div
              className="flex h-7 items-center justify-end rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-3 text-sm font-semibold text-gray-900 transition-[width] duration-500"
              style={{ width: `${Math.max(progress, 8)}%` }}
            >
              {progress.toFixed(2)}%
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#7c828a] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base leading-snug">
                Amount to deposit - After claiming the voucher <span className="font-semibold text-amber-300">&ge; &#2547; {target}</span>
              </p>
              <button
                onClick={onDeposit}
                className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 text-sm font-semibold text-white shadow transition-transform active:scale-95"
              >
                Deposit
              </button>
            </div>
            <div className="mt-3 rounded-full bg-[#2e333a] p-0.5">
              <div className="h-3 rounded-full bg-[#2e333a]" />
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span>{deposited.toFixed(0)}</span>
              <span>{target}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
