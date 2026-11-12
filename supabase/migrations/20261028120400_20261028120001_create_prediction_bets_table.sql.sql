/*
# Create prediction_bets table

1. Purpose
   Stores individual user bets on prediction markets. When a user places a
   prediction (Yes or No), a row is inserted here. When the admin resolves
   the market, the app reads all winning bets for that market and credits
   each user's Firebase balance.

2. New Tables
   - `prediction_bets`
     - `id` (uuid, primary key, auto-generated)
     - `market_id` (uuid, references prediction_markets.id) — which market was bet on
     - `user_uid` (text, not null) — Firebase UID of the user who placed the bet
     - `side` (text, not null) — 'yes' or 'no'
     - `amount` (numeric, not null) — how much was wagered
     - `odds` (numeric, not null) — the odds (price per share) at time of bet, 0-1
     - `shares` (numeric, not null) — amount / odds = payout if correct
     - `status` (text, default 'pending') — 'pending' | 'won' | 'lost'
     - `payout` (numeric, default 0) — amount paid if won (= shares)
     - `paid` (boolean, default false) — whether winnings were credited to user balance
     - `created_at` (timestamptz, default now())

3. Security
   - RLS enabled on prediction_bets.
   - This app uses Firebase auth (not Supabase Auth), so the browser-side
     Supabase client always operates as the anon role. All policies are
     scoped to anon, authenticated — matching the pattern used by every
     other table in this project.
*/

CREATE TABLE IF NOT EXISTS prediction_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES prediction_markets(id) ON DELETE CASCADE,
  user_uid text NOT NULL,
  side text NOT NULL CHECK (side IN ('yes', 'no')),
  amount numeric NOT NULL DEFAULT 0,
  odds numeric NOT NULL DEFAULT 0.5,
  shares numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost')),
  payout numeric NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prediction_bets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON prediction_bets TO anon, authenticated;

DROP POLICY IF EXISTS "pb_select_all" ON prediction_bets;
CREATE POLICY "pb_select_all"
  ON prediction_bets FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "pb_insert_all" ON prediction_bets;
CREATE POLICY "pb_insert_all"
  ON prediction_bets FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "pb_update_all" ON prediction_bets;
CREATE POLICY "pb_update_all"
  ON prediction_bets FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pb_delete_all" ON prediction_bets;
CREATE POLICY "pb_delete_all"
  ON prediction_bets FOR DELETE
  TO anon, authenticated
  USING (true);