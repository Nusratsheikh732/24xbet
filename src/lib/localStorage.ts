import type { Prediction } from '@/types';

const STORAGE_KEYS = {
  user: '24xbet_user',
  predictions: '24xbet_predictions',
  gameHistory: '24xbet_game_history',
  transactions: '24xbet_transactions',
  betAmount: '24xbet_bet_amount',
} as const;

export interface LocalTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'bet' | 'win';
  amount: number;
  method?: string;
  timestamp: number;
}

export interface LocalUserData {
  uid: string;
  email: string;
  name: string;
  phone: string;
  balance: number;
  status: string;
  approved: boolean;
  createdAt: number;
}

export function saveUser(user: LocalUserData | null): void {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.user);
  }
}

export function loadUser(): LocalUserData | null {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalUserData;
  } catch {
    return null;
  }
}

export function savePredictions(predictions: Prediction[]): void {
  localStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(predictions));
}

export function loadPredictions(): Prediction[] {
  const raw = localStorage.getItem(STORAGE_KEYS.predictions);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Prediction[];
  } catch {
    return [];
  }
}

export function saveGameHistory(history: { multiplier: number; color: string }[]): void {
  localStorage.setItem(STORAGE_KEYS.gameHistory, JSON.stringify(history));
}

export function loadGameHistory(): { multiplier: number; color: string }[] {
  const raw = localStorage.getItem(STORAGE_KEYS.gameHistory);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as { multiplier: number; color: string }[];
  } catch {
    return [];
  }
}

export function saveTransactions(transactions: LocalTransaction[]): void {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
}

export function loadTransactions(): LocalTransaction[] {
  const raw = localStorage.getItem(STORAGE_KEYS.transactions);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LocalTransaction[];
  } catch {
    return [];
  }
}

export function addTransaction(transaction: LocalTransaction): LocalTransaction[] {
  const existing = loadTransactions();
  const updated = [transaction, ...existing].slice(0, 100);
  saveTransactions(updated);
  return updated;
}

export function saveBetAmount(amount: number): void {
  localStorage.setItem(STORAGE_KEYS.betAmount, amount.toString());
}

export function loadBetAmount(): number {
  const raw = localStorage.getItem(STORAGE_KEYS.betAmount);
  if (!raw) return 100;
  const val = parseInt(raw, 10);
  return isNaN(val) ? 100 : val;
}

export function clearAllLocalData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}
