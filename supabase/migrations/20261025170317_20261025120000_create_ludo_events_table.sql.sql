/*
# Create Ludo game events table for real-time multiplayer sync

1. New Tables
- `ludo_events` — append-only event log for each Ludo match.
  Each row represents one game action (dice roll or token pick)
  broadcast from one player to all others via Supabase Realtime.
  - `id` (uuid, primary key)
  - `match_id` (uuid, references ludo_matches)
  - `seq` (int, per-match auto-incrementing sequence number so
    players can detect missed events and request the correct order)
  - `actor_uid` (text — Firebase UID of the player who performed the action)
  - `kind` (text: 'roll' | 'pick' | 'start' | 'finish')
  - `payload` (jsonb — event data: { die, tokenIndex, turn, tokens, winner })
  - `created_at` (timestamptz)

2. Security
- Enable RLS on `ludo_events`.
- Grant SELECT, INSERT to `anon, authenticated` (the app uses Firebase auth,
  so the frontend talks via the anon key — same pattern as ludo_matches /
  ludo_queue). DELETE/UPDATE not granted: the log is append-only.
- Policies allow anon + authenticated read and insert because match
  coordination is client-driven.

3. Notes
- `seq` is assigned client-side as (max seq for match) + 1. Concurrency
  conflicts are acceptable here because each match has a single source of
  truth for turn order (the match creator's loop); other players only
  echo events they observe. If a duplicate seq appears, clients keep the
  earliest by created_at.
- The `kind='start'` event carries the authoritative initial turn index
  so all players start the game on the same player's turn.
- The `kind='finish'` event carries the winner so all players can end
  their local loop and display the result screen.
*/

CREATE TABLE IF NOT EXISTS ludo_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES ludo_matches(id) ON DELETE CASCADE,
  seq int NOT NULL,
  actor_uid text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('start', 'roll', 'pick', 'finish')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ludo_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON ludo_events TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_ludo_events" ON ludo_events;
CREATE POLICY "anon_select_ludo_events"
ON ludo_events FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ludo_events" ON ludo_events;
CREATE POLICY "anon_insert_ludo_events"
ON ludo_events FOR INSERT
TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ludo_events_match_seq
ON ludo_events(match_id, seq);
