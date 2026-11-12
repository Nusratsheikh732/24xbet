import {
  db,
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  onChildAdded,
  runTransaction,
  query,
  orderByChild,
  equalTo,
} from '@/lib/firebase';

export interface LudoSeatInfo {
  uid: string;
  name: string;
  color: string;
}

export interface LudoQueueRow {
  id: string;
  player_uid: string;
  player_name: string;
  player_count: number;
  bet_amount: number;
  color: string;
  status: string;
  match_id?: string;
  created_at: number;
}

export interface LudoMatchInfo {
  id: string;
  bet_amount: number;
  players: LudoSeatInfo[];
}

export interface LudoRemoteEvent {
  seq: number;
  actor_uid: string;
  kind: string;
  payload: Record<string, unknown>;
}

type RawRecord = Record<string, unknown>;

function pushKey(itemRef: { key: string | null }): string {
  if (!itemRef.key) throw new Error('Could not allocate a Ludo record id');
  return itemRef.key;
}

function recordEntries(val: unknown): [string, RawRecord][] {
  if (!val || typeof val !== 'object') return [];
  return Object.entries(val as RawRecord).filter(
    (entry): entry is [string, RawRecord] => !!entry[1] && typeof entry[1] === 'object',
  );
}

function toQueueRow([id, r]: [string, RawRecord]): LudoQueueRow {
  return {
    id,
    player_uid: String(r.player_uid ?? ''),
    player_name: String(r.player_name ?? ''),
    player_count: Number(r.player_count) || 0,
    bet_amount: Number(r.bet_amount) || 0,
    color: String(r.color ?? ''),
    status: String(r.status ?? ''),
    match_id: typeof r.match_id === 'string' ? r.match_id : undefined,
    created_at: Number(r.created_at) || 0,
  };
}

function toSeats(val: unknown): LudoSeatInfo[] {
  if (!val || typeof val !== 'object') return [];
  return Object.values(val as RawRecord)
    .filter((p): p is RawRecord => !!p && typeof p === 'object')
    .map((p) => ({ uid: String(p.uid ?? ''), name: String(p.name ?? ''), color: String(p.color ?? '') }));
}

export async function joinQueue(input: {
  player_uid: string;
  player_name: string;
  player_count: number;
  bet_amount: number;
  color: string;
}): Promise<string> {
  const itemRef = push(ref(db, 'ludo_queue'));
  await set(itemRef, { ...input, status: 'searching', created_at: Date.now() });
  return pushKey(itemRef);
}

export async function getQueueRow(id: string): Promise<LudoQueueRow | null> {
  const snap = await get(ref(db, `ludo_queue/${id}`));
  if (!snap.exists()) return null;
  return toQueueRow([id, snap.val() as RawRecord]);
}

export async function listSearchingQueue(playerCount: number, betAmount: number): Promise<LudoQueueRow[]> {
  const snap = await get(query(ref(db, 'ludo_queue'), orderByChild('player_count'), equalTo(playerCount)));
  return recordEntries(snap.val())
    .map(toQueueRow)
    .filter((row) => row.status === 'searching' && row.bet_amount === betAmount)
    .sort((a, b) => a.created_at - b.created_at);
}

export async function purgeStaleSearches(cutoffMs: number): Promise<void> {
  const snap = await get(ref(db, 'ludo_queue'));
  const stale = recordEntries(snap.val())
    .map(toQueueRow)
    .filter((row) => row.status === 'searching' && row.created_at < cutoffMs);
  await Promise.all(stale.map((row) => remove(ref(db, `ludo_queue/${row.id}`))));
}

export function leaveQueue(id: string): Promise<void> {
  return remove(ref(db, `ludo_queue/${id}`));
}

export function subscribeQueue(onChange: () => void): () => void {
  return onValue(ref(db, 'ludo_queue'), () => onChange());
}

export async function createMatch(input: {
  player_count: number;
  bet_amount: number;
  created_by: string;
  players: LudoSeatInfo[];
}): Promise<string> {
  const itemRef = push(ref(db, 'ludo_matches'));
  await set(itemRef, {
    ...input,
    status: 'playing',
    started_at: Date.now(),
    reward_paid: false,
  });
  return pushKey(itemRef);
}

export async function markQueueRowsMatched(queueIds: string[], matchId: string): Promise<void> {
  await Promise.all(
    queueIds
      .filter(Boolean)
      .map((id) => update(ref(db, `ludo_queue/${id}`), { status: 'matched', match_id: matchId })),
  );
}

export async function getMatch(id: string): Promise<LudoMatchInfo | null> {
  const snap = await get(ref(db, `ludo_matches/${id}`));
  if (!snap.exists()) return null;
  const r = snap.val() as RawRecord;
  return { id, bet_amount: Number(r.bet_amount) || 0, players: toSeats(r.players) };
}

export async function appendMatchEvent(matchId: string, event: Omit<LudoRemoteEvent, 'payload'> & { payload: Record<string, unknown> }) {
  await set(push(ref(db, `ludo_events/${matchId}`)), { ...event, created_at: Date.now() });
}

export function subscribeMatchEvents(matchId: string, onEvent: (ev: LudoRemoteEvent) => void): () => void {
  return onChildAdded(ref(db, `ludo_events/${matchId}`), (snap) => {
    const r = snap.val() as RawRecord | null;
    if (!r) return;
    onEvent({
      seq: Number(r.seq) || 0,
      actor_uid: String(r.actor_uid ?? ''),
      kind: String(r.kind ?? ''),
      payload: (r.payload && typeof r.payload === 'object' ? r.payload : {}) as Record<string, unknown>,
    });
  });
}

/** Atomically claims a finished match's reward and records the result. Returns false if already claimed. */
export async function claimMatchResult(
  matchId: string,
  result: { winner_uid: string; winner_name: string; bet_amount: number; reward_amount: number; player_count: number },
): Promise<boolean> {
  const claim = await runTransaction(ref(db, `ludo_matches/${matchId}/reward_paid`), (current: unknown) =>
    current === true ? undefined : true,
  );
  if (!claim.committed) return false;
  await update(ref(db, `ludo_matches/${matchId}`), {
    status: 'finished',
    finished_at: Date.now(),
    winner_uid: result.winner_uid,
  });
  await set(push(ref(db, 'ludo_results')), { match_id: matchId, ...result, created_at: Date.now() });
  return true;
}
