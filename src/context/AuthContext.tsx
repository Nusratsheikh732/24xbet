import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, db, ref, get, set, update, onValue, push } from '@/lib/firebase';
import { saveUser, loadUser, addTransaction, clearAllLocalData } from '@/lib/localStorage';
import { pickRandomAvatar } from '@/lib/avatars';

export interface UserData {
  uid: string;
  email: string;
  name: string;
  phone: string;
  balance: number;
  status: string;
  approved: boolean;
  createdAt: number;
  turnover: number;
  turnoverTarget?: number;
  referralCode: string;
  referredBy: string;
  pendingRefers: number;
  completedRefers: number;
  referralEarnings: number;
  avatar: string;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (identifier: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateBalance: (newBalance: number) => Promise<void>;
  deductBalance: (amount: number) => Promise<void>;
  addBalance: (amount: number) => Promise<void>;
  setAvatar: (avatar: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(loadUser);
  const [loading, setLoading] = useState(true);
  const balanceRef = useRef<number>(loadUser()?.balance ?? 0);

  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      if (firebaseUser) {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        unsubUser = onValue(userRef, (snap) => {
          try {
            if (snap.exists()) {
              const data = snap.val();
              const userData: UserData = {
                uid: firebaseUser.uid,
                email: data.email || firebaseUser.email || '',
                name: data.name || '',
                phone: data.phone || '',
                balance: data.balance || 0,
                status: data.status || 'active',
                approved: data.approved !== false,
                createdAt: data.createdAt || Date.now(),
                turnover: data.turnover || 0,
                turnoverTarget: data.turnoverTarget ?? undefined,
                referralCode: data.referralCode || '',
                referredBy: data.referredBy || '',
                pendingRefers: data.pendingRefers || 0,
                completedRefers: data.completedRefers || 0,
                referralEarnings: data.referralEarnings || 0,
                avatar: data.avatar || '',
              };
              setUser(userData);
              balanceRef.current = data.balance || 0;
              saveUser(userData);
            } else {
              const fallback: UserData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: '',
                phone: '',
                balance: 0,
                status: 'active',
                approved: true,
                createdAt: Date.now(),
                turnover: 0,
                referralCode: '',
                referredBy: '',
                pendingRefers: 0,
                completedRefers: 0,
                referralEarnings: 0,
                avatar: '',
              };
              setUser(fallback);
              saveUser(fallback);
            }
          } catch {
            const fallback: UserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: '',
              phone: '',
              balance: 0,
              status: 'active',
              approved: true,
              createdAt: Date.now(),
              turnover: 0,
              referralCode: '',
              referredBy: '',
              pendingRefers: 0,
              completedRefers: 0,
              referralEarnings: 0,
              avatar: '',
            };
            setUser(fallback);
            saveUser(fallback);
          }
          setLoading(false);
        }, () => {
          // Database read error — use fallback user to prevent blank screen
          const fallback: UserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: '',
            phone: '',
            balance: 0,
            status: 'active',
            approved: true,
            createdAt: Date.now(),
            turnover: 0,
            referralCode: '',
            referredBy: '',
            pendingRefers: 0,
            completedRefers: 0,
            referralEarnings: 0,
            avatar: '',
          };
          setUser(fallback);
          saveUser(fallback);
          setLoading(false);
        });
      } else {
        setUser(null);
        saveUser(null);
        clearAllLocalData();
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
    };
  }, []);

  const isEmail = (id: string) => id.includes('@');

  const toAuthEmail = (identifier: string) => {
    const trimmed = identifier.trim();
    if (isEmail(trimmed)) return trimmed;
    const digits = trimmed.replace(/\D/g, '');
    return `${digits}@24xbet.com`;
  };

  const generateUsername = useCallback(async (): Promise<string> => {
    const snap = await get(ref(db, 'users'));
    const count = snap.exists() ? Object.keys(snap.val()).length : 0;
    return `User${count + 1}`;
  }, []);

  const generateReferralCode = useCallback(async (): Promise<string> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = '24X';
      for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const snap = await get(ref(db, 'users'));
      if (!snap.exists()) return code;
      const allUsers = snap.val();
      let exists = false;
      for (const uid in allUsers) {
        if (allUsers[uid].referralCode === code) { exists = true; break; }
      }
      if (!exists) return code;
    }
    return '24X' + Date.now().toString(36).toUpperCase().slice(-5);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const authEmail = toAuthEmail(identifier);
    await signInWithEmailAndPassword(auth, authEmail, password);
  }, []);

  const signup = useCallback(async (identifier: string, password: string, referralCode?: string) => {
    const authEmail = toAuthEmail(identifier);
    const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
    const userRef = ref(db, `users/${cred.user.uid}`);
    const autoName = await generateUsername();
    const newReferralCode = await generateReferralCode();
    const trimmed = identifier.trim();
    const isEmailInput = isEmail(trimmed);

    let referredBy = '';
    let referrerUid = '';
    if (referralCode && referralCode.trim()) {
      const code = referralCode.trim().toUpperCase();
      const usersSnap = await get(ref(db, 'users'));
      if (usersSnap.exists()) {
        const allUsers = usersSnap.val();
        for (const uid in allUsers) {
          if (allUsers[uid].referralCode === code) {
            referredBy = code;
            referrerUid = uid;
            break;
          }
        }
      }
    }

    const avatar = await pickRandomAvatar(cred.user.uid);

    await set(userRef, {
      email: authEmail,
      password,
      name: autoName,
      phone: isEmailInput ? '' : trimmed,
      balance: 0,
      status: 'active',
      approved: true,
      createdAt: Date.now(),
      turnover: 0,
      referralCode: newReferralCode,
      referredBy,
      pendingRefers: 0,
      completedRefers: 0,
      referralEarnings: 0,
      avatar,
    });

    if (referrerUid) {
      const referrerRef = ref(db, `users/${referrerUid}`);
      const referrerSnap = await get(referrerRef);
      if (referrerSnap.exists()) {
        const rd = referrerSnap.val();
        await update(referrerRef, {
          pendingRefers: (rd.pendingRefers || 0) + 1,
        });
      }
      const referralEntry = push(ref(db, 'referrals'));
      await set(referralEntry, {
        referrerUid,
        referrerCode: referredBy,
        referredUid: cred.user.uid,
        status: 'pending',
        bonusAmount: 50,
        createdAt: Date.now(),
      });
    }
  }, [generateUsername, generateReferralCode]);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const updateBalance = useCallback(async (newBalance: number) => {
    if (!user) return;
    await update(ref(db, `users/${user.uid}`), { balance: newBalance });
  }, [user]);

  const deductBalance = useCallback(async (amount: number) => {
    if (!user) return;
    const currentBalance = balanceRef.current;
    const newBalance = Math.max(0, currentBalance - amount);
    const newTurnover = (user.turnover || 0) + amount;
    balanceRef.current = newBalance;
    const updated = { ...user, balance: newBalance, turnover: newTurnover };
    setUser(updated);
    saveUser(updated);
    await update(ref(db, `users/${user.uid}`), { balance: newBalance, turnover: newTurnover });
    addTransaction({ id: `${Date.now()}-bet`, type: 'bet', amount, timestamp: Date.now() });
  }, [user]);

  const addBalance = useCallback(async (amount: number) => {
    if (!user) return;
    const currentBalance = balanceRef.current;
    const newBalance = currentBalance + amount;
    balanceRef.current = newBalance;
    const updated = { ...user, balance: newBalance };
    setUser(updated);
    saveUser(updated);
    await update(ref(db, `users/${user.uid}`), { balance: newBalance });
  }, [user]);

  const setAvatar = useCallback(async (avatar: string) => {
    if (!user) return;
    await update(ref(db, `users/${user.uid}`), { avatar });
    const updated = { ...user, avatar };
    setUser(updated);
    saveUser(updated);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateBalance, deductBalance, addBalance, setAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
