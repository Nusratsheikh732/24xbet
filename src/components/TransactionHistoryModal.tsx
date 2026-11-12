import { History, ArrowDownCircle, ArrowUpCircle, TrendingUp, Trophy } from 'lucide-react';
import ModalShell from '@/components/ModalShell';
import { loadTransactions, type LocalTransaction } from '@/lib/localStorage';
import { useLanguage } from '@/context/LanguageContext';
import { useState, useEffect } from 'react';

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeConfig: Record<LocalTransaction['type'], { icon: typeof ArrowDownCircle; color: string; label: string }> = {
  deposit: { icon: ArrowDownCircle, color: 'text-neon-green', labelKey: 'tx.deposit' },
  withdraw: { icon: ArrowUpCircle, color: 'text-neon-red', labelKey: 'tx.withdraw' },
  bet: { icon: TrendingUp, color: 'text-neon-blue', labelKey: 'tx.bet' },
  win: { icon: Trophy, color: 'text-neon-gold', labelKey: 'tx.win' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function TransactionHistoryModal({ isOpen, onClose }: TransactionHistoryModalProps) {
  const { t, bn } = useLanguage();
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTransactions(loadTransactions());
    }
  }, [isOpen]);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction History"
      icon={<History size={20} className="text-neon-blue" />}
    >
      {transactions.length === 0 ? (
        <div className="text-center py-10">
          <History size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-semibold">No transactions yet</p>
          <p className="text-xs text-gray-600 mt-1">Your deposits, withdrawals, and bets will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const cfg = typeConfig[tx.type];
            const Icon = cfg.icon;
            const isNegative = tx.type === 'withdraw' || tx.type === 'bet';
            return (
              <div
                key={tx.id}
                className="bg-dark-card2 rounded-xl border border-dark-border p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-dark-card flex items-center justify-center shrink-0">
                  <Icon size={18} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{t(cfg.labelKey)}</p>
                  <p className="text-xs text-gray-500">{formatTime(tx.timestamp)}{tx.method ? ` · ${t(`payment.${tx.method}`)}` : ''}</p>
                </div>
                <p className={`text-sm font-bold shrink-0 ${isNegative ? 'text-neon-red' : 'text-neon-green'}`}>
                  {isNegative ? '-' : '+'}৳{bn(tx.amount.toFixed(2))}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}
