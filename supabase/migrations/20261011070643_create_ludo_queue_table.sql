/*
# Create Ludo matchmaking queue table

1. New Tables
- `ludo_queue` — a real-time matchmaking queue for online Ludo matches.
  Players insert a row when they start searching; other players find it
  and join. When the required player count is reached, the match starts.
  - `id` (uuid, primary key)
  - `player_uid` (text — Firebase UID of the queued player)
  - `player_name` (text — display name shown in the lobby)
  - `player_count` (int — 2, 3, or 4 — required players for this match)
  - `bet_amount` (numeric — stake amount)
  - `color` (text — seat color assigned to this player: red/green/yellow/blue)
  - `status` (text: searching | matched | cancelled)
  - `match_id` (uuid, nullable — references ludo_matches.id once a match is created)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on `ludo_queue`.
- The app uses Firebase auth (not Supabase auth), so anon-key access is needed.
- All policies use `TO anon, authenticated` per the existing pattern.

3. Notes
- Players poll/subscribe to rows with matching `player_count` + `bet_amount` + `status='searching'`.
- When enough players are queued, one player creates a `ludo_matches` row and
  updates all queue rows to `status='matched'` with the `match_id`.
- Stale `searching` rows (older than 60 seconds) are cleaned up automatically
  by the client on each search cycle.
*/

CREATE TABLE IF NOT EXISTS ludo_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_uid text NOT NULL,
  player_name text NOT NULL DEFAULT 'Player',
  player_count int NOT NULL CHECK (player_count IN (2, 3, 4)),
  bet_amount numeric NOT NULL DEFAULT 50,
  color text NOT NULL DEFAULT 'blue',
  status text NOT NULL DEFAULT 'searching',
  match_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ludo_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ludo_queue" ON ludo_queue;
CREATE POLICY "anon_select_ludo_queue"
ON ludo_queue FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ludo_queue" ON ludo_queue;
CREATE POLICY "anon_insert_ludo_queue"
ON ludo_queue FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ludo_queue" ON ludo_queue;
CREATE POLICY "anon_update_ludo_queue"
ON ludo_queue FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ludo_queue" ON ludo_queue;
CREATE POLICY "anon_delete_ludo_queue"
ON ludo_queue FOR DELETE
TO anon, authenticated USING (true);

-- Index for finding searching players by config
CREATE INDEX IF NOT EXISTS idx_ludo_queue_status_count_bet
ON ludo_queue(status, player_count, bet_amount);
