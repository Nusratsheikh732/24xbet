import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { db, ref, onValue, update } from '@/lib/firebase';
import { showNotification } from '@/lib/notifications';
import { useAuth } from '@/context/AuthContext';

export interface AppNotification {
  id: string;
  type: 'deposit' | 'withdraw' | 'admin' | 'support' | 'prediction';
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seenDepositStatusRef = useRef<Record<string, string>>({});
  const seenWithdrawStatusRef = useRef<Record<string, string>>({});
  const seenPredictionStatusRef = useRef<Record<string, string>>({});
  const lastSupportMsgRef = useRef<string | null>(null);

  const addNotification = useCallback((n: AppNotification, shouldPush: boolean) => {
    setNotifications((prev) => {
      if (prev.some((p) => p.id === n.id)) return prev;
      return [n, ...prev].slice(0, 100);
    });
    if (shouldPush) {
      showNotification(n.title, n.body);
    }
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && target.type === 'admin') {
        update(ref(db, `notifications/${id}`), { read: true }).catch(() => {});
      }
      return prev.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const unread = prev.filter((n) => !n.read);
      unread.forEach((n) => {
        if (n.type === 'admin') {
          update(ref(db, `notifications/${n.id}`), { read: true }).catch(() => {});
        }
      });
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, []);

  const refresh = useCallback(() => {
    markAllRead();
  }, [markAllRead]);

  // ── Deposit status listener ──
  useEffect(() => {
    if (!user) return;
    const depositsRef = ref(db, 'deposit_requests');
    const unsub = onValue(depositsRef, (snap) => {
      if (!snap.exists()) return;
      const all = snap.val();
      for (const id in all) {
        const data = all[id];
        if (data.userId !== user.uid) continue;
        const prevStatus = seenDepositStatusRef.current[id];
        if (prevStatus === data.status) continue;
        seenDepositStatusRef.current[id] = data.status;
        if (prevStatus === undefined) continue;

        if (data.status === 'approved') {
          addNotification({
            id: `dep-${id}`,
            type: 'deposit',
            title: 'Deposit Approved',
            body: `Your deposit of ৳${data.amount} has been approved and added to your balance.`,
            read: false,
            createdAt: Date.now(),
          }, true);
        } else if (data.status === 'rejected') {
          addNotification({
            id: `dep-${id}`,
            type: 'deposit',
            title: 'Deposit Rejected',
            body: `Your deposit request of ৳${data.amount} was rejected. Please contact support.`,
            read: false,
            createdAt: Date.now(),
          }, true);
        }
      }
    });
    return () => unsub();
  }, [user, addNotification]);

  // ── Withdrawal status listener ──
  useEffect(() => {
    if (!user) return;
    const withdrawRef = ref(db, 'withdraw_requests');
    const unsub = onValue(withdrawRef, (snap) => {
      if (!snap.exists()) return;
      const all = snap.val();
      for (const id in all) {
        const data = all[id];
        if (data.userId !== user.uid) continue;
        const prevStatus = seenWithdrawStatusRef.current[id];
        if (prevStatus === data.status) continue;
        seenWithdrawStatusRef.current[id] = data.status;
        if (prevStatus === undefined) continue;

        if (data.status === 'approved') {
          addNotification({
            id: `wd-${id}`,
            type: 'withdraw',
            title: 'Withdrawal Successful',
            body: `Your withdrawal of ৳${data.amount} has been sent to your ${data.method} account.`,
            read: false,
            createdAt: Date.now(),
          }, true);
        } else if (data.status === 'rejected') {
          addNotification({
            id: `wd-${id}`,
            type: 'withdraw',
            title: 'Withdrawal Rejected',
            body: `Your withdrawal request of ৳${data.amount} was rejected. The amount has been refunded to your balance.`,
            read: false,
            createdAt: Date.now(),
          }, true);
        }
      }
    });
    return () => unsub();
  }, [user, addNotification]);

  // ── Admin custom notifications listener ──
  useEffect(() => {
    if (!user) return;
    const notifRef = ref(db, 'notifications');
    const unsub = onValue(notifRef, (snap) => {
      if (!snap.exists()) return;
      const all = snap.val();
      for (const id in all) {
        if (seenIdsRef.current.has(id)) continue;
        const data = all[id];
        if (data.targetUid !== user.uid) continue;
        seenIdsRef.current.add(id);
        const notif: AppNotification = {
          id,
          type: 'admin',
          title: data.title || '24xbet',
          body: data.body || '',
          read: data.read === true,
          createdAt: data.createdAt || Date.now(),
        };
        addNotification(notif, !notif.read);
      }
    });
    return () => unsub();
  }, [user, addNotification]);

  // ── Support message listener (admin replies) ──
  useEffect(() => {
    if (!user) return;

    let initialized = false;
    const unsub = onValue(ref(db, `support/messages/${user.uid}`), (snap) => {
      const raw = (snap.val() || {}) as Record<string, { sender?: string; text?: string; createdAt?: number }>;
      const adminMsgs = Object.entries(raw)
        .filter(([, m]) => m && m.sender === 'admin' && typeof m.text === 'string')
        .sort(([, a], [, b]) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      const last = adminMsgs[adminMsgs.length - 1];
      if (!initialized) {
        initialized = true;
        if (last) lastSupportMsgRef.current = last[0];
        return;
      }
      if (!last) return;
      const [id, row] = last;
      if (lastSupportMsgRef.current === id) return;
      lastSupportMsgRef.current = id;
      addNotification({
        id: `support-${id}`,
        type: 'support',
        title: 'Support Reply',
        body: (row.text ?? '').slice(0, 100),
        read: false,
        createdAt: row.createdAt || Date.now(),
      }, true);
    });

    return () => unsub();
  }, [user, addNotification]);

  // ── Prediction settlement listener ──
  useEffect(() => {
    if (!user) return;
    const predRef = ref(db, 'sports_predictions');
    const unsub = onValue(predRef, (snap) => {
      if (!snap.exists()) return;
      const all = snap.val();
      for (const id in all) {
        const data = all[id];
        if (data.userId !== user.uid) continue;
        const prevStatus = seenPredictionStatusRef.current[id];
        if (prevStatus === data.status) continue;
        seenPredictionStatusRef.current[id] = data.status;
        if (prevStatus === undefined) continue;

        if (data.status === 'won') {
          addNotification({
            id: `pred-${id}`,
            type: 'prediction',
            title: 'Prediction Won!',
            body: `Your prediction won! You earned ৳${data.payout}.`,
            read: false,
            createdAt: Date.now(),
          }, true);
        } else if (data.status === 'lost') {
          addNotification({
            id: `pred-${id}`,
            type: 'prediction',
            title: 'Prediction Lost',
            body: `Your prediction on ${data.team || 'the match'} was not successful.`,
            read: false,
            createdAt: Date.now(),
          }, true);
        }
      }
    });
    return () => unsub();
  }, [user, addNotification]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      seenIdsRef.current.clear();
      seenDepositStatusRef.current = {};
      seenWithdrawStatusRef.current = {};
      seenPredictionStatusRef.current = {};
      lastSupportMsgRef.current = null;
    }
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
