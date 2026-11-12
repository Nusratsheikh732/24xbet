import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, get, set, update, push, onValue, onChildAdded, remove, serverTimestamp, runTransaction, query, orderByChild, equalTo } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBPSGzqPM6HefOoaBY80cNKdOAh__NNsX8',
  authDomain: 'a24xbet.firebaseapp.com',
  databaseURL: 'https://a24xbet-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'a24xbet',
  storageBucket: 'a24xbet.firebasestorage.app',
  messagingSenderId: '475119405666',
  appId: '1:475119405666:web:920de0ff344d044a9c9f3b',
  measurementId: 'G-NLHV6YGWQW',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

export { ref, get, set, update, push, onValue, onChildAdded, remove, serverTimestamp, runTransaction, query, orderByChild, equalTo };

const DEFAULT_PAYMENT_NUMBERS: Record<string, string> = {
  nagad: '01907262606',
  bkash: '01907262606',
  rocket: '01907262606',
  binance: '',
  upay: '01907262606',
  usdt: '',
  bybit: '',
  bitget: '',
};

const DEFAULT_PAYMENT_INSTRUCTIONS: Record<string, string> = {
  nagad: 'Send money to the number above, then enter your sender number.',
  bkash: 'Send money to the number above, then enter your sender number.',
  rocket: 'Send money to the number above, then enter your sender number.',
  binance: 'Send funds from your Binance account, then enter your nickname.',
  upay: 'Send money to the number above, then enter your sender number.',
  usdt: 'Send USDT to the wallet address shown, then enter the Transaction ID.',
  bybit: 'Send funds from your Bybit account, then enter your nickname.',
  bitget: 'Send funds from your Bitget account, then enter your nickname.',
};

let initStarted = false;
export function ensureDefaultPaymentSettings() {
  if (initStarted) return;
  initStarted = true;

  (async () => {
    try {
      const snap = await get(ref(db, 'game_settings/payment_numbers'));
      if (!snap.exists()) {
        await set(ref(db, 'game_settings/payment_numbers'), {
          numbers: DEFAULT_PAYMENT_NUMBERS,
          instructions: DEFAULT_PAYMENT_INSTRUCTIONS,
          updatedAt: Date.now(),
        });
      }
    } catch {
      // ignore — will retry on next app load
    }

    try {
      const aviatorSnap = await get(ref(db, 'game_settings/aviator'));
      if (!aviatorSnap.exists()) {
        await set(ref(db, 'game_settings/aviator'), { active: true, updatedAt: Date.now() });
      }
    } catch {
      // ignore
    }

    try {
      const flyxSnap = await get(ref(db, 'game_settings/flyx'));
      if (!flyxSnap.exists()) {
        await set(ref(db, 'game_settings/flyx'), {
          early_crash_ratio: 0.8,
          min_crash_mult: 1.01,
          max_early_crash: 1.50,
          max_late_crash: 9.50,
        });
      }
    } catch {
      // ignore
    }

    try {
      const turnoverSnap = await get(ref(db, 'game_settings/turnover'));
      if (!turnoverSnap.exists()) {
        await set(ref(db, 'game_settings/turnover'), { target: 100, updatedAt: Date.now() });
      }
    } catch {
      // ignore
    }
  })();
}

ensureDefaultPaymentSettings();

export default app;
