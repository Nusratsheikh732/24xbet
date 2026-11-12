import {
  db,
  ref,
  get,
  push,
  set,
  update,
  remove,
  onValue,
  runTransaction,
  query,
  orderByChild,
  equalTo,
} from '@/lib/firebase';

export interface PredictionMarket {
  id: string;
  title: string;
  category: string;
  option_yes_label: string;
  option_no_label: string;
  odds_yes: number;
  odds_no: number;
  end_date: string;
  status: string;
  resolution: 'yes' | 'no' | null;
  volume: number;
  created_at: string;
}

export interface PredictionBet {
  id: string;
  market_id: string;
  user_uid: string;
  side: 'yes' | 'no';
  amount: number;
  odds: number;
  shares: number;
  status: 'pending' | 'won' | 'lost';
  payout: number;
  paid: boolean;
  created_at: string;
}

type RawRecord = Record<string, unknown>;

function asRecords(val: unknown): [string, RawRecord][] {
  if (!val || typeof val !== 'object') return [];
  return Object.entries(val as Record<string, unknown>).filter(
    (entry): entry is [string, RawRecord] => !!entry[1] && typeof entry[1] === 'object',
  );
}

function parseMarket([id, r]: [string, RawRecord]): PredictionMarket {
  const resolution = r.resolution === 'yes' || r.resolution === 'no' ? r.resolution : null;
  return {
    id,
    title: String(r.title ?? ''),
    category: String(r.category ?? ''),
    option_yes_label: String(r.option_yes_label ?? 'Yes'),
    option_no_label: String(r.option_no_label ?? 'No'),
    odds_yes: Number(r.odds_yes) || 0.5,
    odds_no: Number(r.odds_no) || 0.5,
    end_date: String(r.end_date ?? ''),
    status: String(r.status ?? 'active'),
    resolution,
    volume: Number(r.volume) || 0,
    created_at: String(r.created_at ?? ''),
  };
}

function parseBet([id, r]: [string, RawRecord]): PredictionBet {
  return {
    id,
    market_id: String(r.market_id ?? ''),
    user_uid: String(r.user_uid ?? ''),
    side: r.side === 'no' ? 'no' : 'yes',
    amount: Number(r.amount) || 0,
    odds: Number(r.odds) || 0,
    shares: Number(r.shares) || 0,
    status: r.status === 'won' || r.status === 'lost' ? r.status : 'pending',
    payout: Number(r.payout) || 0,
    paid: r.paid === true,
    created_at: String(r.created_at ?? ''),
  };
}

export function subscribeMarkets(onChange: (markets: PredictionMarket[]) => void): () => void {
  return onValue(
    ref(db, 'prediction_markets'),
    (snap) => {
      const list = asRecords(snap.val()).map(parseMarket);
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      onChange(list);
    },
    () => onChange([]),
  );
}

export function subscribeUserBets(uid: string, onChange: (bets: PredictionBet[]) => void): () => void {
  return onValue(
    query(ref(db, 'prediction_bets'), orderByChild('user_uid'), equalTo(uid)),
    (snap) => onChange(asRecords(snap.val()).map(parseBet)),
    () => onChange([]),
  );
}

export async function fetchMarket(id: string): Promise<PredictionMarket | null> {
  const snap = await get(ref(db, `prediction_markets/${id}`));
  if (!snap.exists()) return null;
  return parseMarket([id, snap.val() as RawRecord]);
}

export async function createPredictionMarket(input: {
  title: string;
  category: string;
  option_yes_label: string;
  option_no_label: string;
  odds_yes: number;
  end_date: string;
}) {
  await set(push(ref(db, 'prediction_markets')), {
    title: input.title,
    category: input.category,
    option_yes_label: input.option_yes_label,
    option_no_label: input.option_no_label,
    odds_yes: input.odds_yes,
    odds_no: 1 - input.odds_yes,
    end_date: input.end_date,
    status: 'active',
    resolution: null,
    volume: 0,
    created_at: new Date().toISOString(),
  });
}

export async function deletePredictionMarket(id: string) {
  await remove(ref(db, `prediction_markets/${id}`));
}

export async function resolvePredictionMarket(id: string, resolution: 'yes' | 'no') {
  await update(ref(db, `prediction_markets/${id}`), { status: 'resolved', resolution });
}

export async function placePredictionBet(input: {
  market_id: string;
  user_uid: string;
  side: 'yes' | 'no';
  amount: number;
  odds: number;
}) {
  await set(push(ref(db, 'prediction_bets')), {
    market_id: input.market_id,
    user_uid: input.user_uid,
    side: input.side,
    amount: input.amount,
    odds: input.odds,
    shares: input.amount / input.odds,
    status: 'pending',
    payout: 0,
    paid: false,
    created_at: new Date().toISOString(),
  });
}

/** Settles a pending bet once. Returns the payout to credit, or null if already settled. */
export async function settlePredictionBet(bet: PredictionBet, resolution: 'yes' | 'no'): Promise<number | null> {
  const isWin = bet.side === resolution;
  const payout = isWin ? bet.shares : 0;
  const result = await runTransaction(ref(db, `prediction_bets/${bet.id}`), (current: RawRecord | null) => {
    if (!current || current.status !== 'pending') return;
    return { ...current, status: isWin ? 'won' : 'lost', payout, paid: isWin };
  });
  if (!result.committed) return null;
  return payout;
}
