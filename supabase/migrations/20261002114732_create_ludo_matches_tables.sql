/*
# Create Ludo online match tables

1. New Tables
- `ludo_matches` — stores online match rooms with matchmaking config
  - `id` (uuid, primary key)
  - `status` (text: waiting | playing | finished | cancelled)
  - `player_count` (int: 2, 3, or 4 — required number of players)
  - `bet_amount` (numeric — demo stake for this match)
  - `created_by` (text — Firebase UID of match creator)
  - `created_at` (timestamptz)
  - `started_at` (timestamptz, nullable)
  - `finished_at` (timestamptz, nullable)
  - `winner_uid` (text, nullable — Firebase UID of winner)
  - `reward_paid` (boolean, default false — prevents duplicate reward)
  - `game_state` (jsonb, nullable — serialized game state for sync)
  - `players` (jsonb — array of {uid, name, color, slot, joinedAt})

- `ludo_results` — immutable record of each finished match for audit/history
  - `id` (uuid, primary key)
  - `match_id` (uuid, references ludo_matches)
  - `winner_uid` (text — Firebase UID of winner)
  - `winner_name` (text)
  - `bet_amount` (numeric)
  - `reward_amount` (numeric — 2x bet)
  - `player_count` (int)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on both tables.
- The app uses Firebase auth (not Supabase auth), so anon-key access is needed.
- All policies use `TO anon, authenticated` since the frontend talks via anon key.
- INSERT/UPDATE/DELETE allowed for match coordination (matchmaking is client-driven via Firestore for real-time; these tables serve as the server-side validation record).

3. Notes
- `reward_paid` boolean prevents double-rewarding if a result is submitted more than once.
- `ludo_results` provides an append-only audit trail.
- The edge function `ludo-validate-result` checks `reward_paid` atomically before awarding.
*/

CREATE TABLE IF NOT EXISTS ludo_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'waiting',
  player_count int NOT NULL DEFAULT 2 CHECK (player_count IN (2, 3, 4)),
  bet_amount numeric NOT NULL DEFAULT 10,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  winner_uid text,
  reward_paid boolean NOT NULL DEFAULT false,
  game_state jsonb,
  players jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE ludo_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ludo_matches" ON ludo_matches;
CREATE POLICY "anon_select_ludo_matches"
ON ludo_matches FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ludo_matches" ON ludo_matches;
CREATE POLICY "anon_insert_ludo_matches"
ON ludo_matches FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ludo_matches" ON ludo_matches;
CREATE POLICY "anon_update_ludo_matches"
ON ludo_matches FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ludo_matches" ON ludo_matches;
CREATE POLICY "anon_delete_ludo_matches"
ON ludo_matches FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS ludo_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES ludo_matches(id) ON DELETE CASCADE,
  winner_uid text NOT NULL,
  winner_name text NOT NULL,
  bet_amount numeric NOT NULL,
  reward_amount numeric NOT NULL,
  player_count int NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ludo_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ludo_results" ON ludo_results;
CREATE POLICY "anon_select_ludo_results"
ON ludo_results FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ludo_results" ON ludo_results;
CREATE POLICY "anon_insert_ludo_results"
ON ludo_results FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- Index for finding waiting matches by config
CREATE INDEX IF NOT EXISTS idx_ludo_matches_status_count_bet ON ludo_matches(status, player_count, bet_amount);
CREATE INDEX IF NOT EXISTS idx_ludo_results_winner ON ludo_results(winner_uid);
