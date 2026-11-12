/*
# Create prediction_markets table

1. Purpose
   Stores prediction market events (Polymarket-style yes/no outcomes with odds).
   Admins create and manage events; all users can view active events.

2. New Tables
   - `prediction_markets`
     - `id` (uuid, primary key, auto-generated)
     - `title` (text, not null) — the prediction question, e.g. "Will BTC hit $100k by Dec?"
     - `category` (text, not null) — e.g. "Crypto", "Sports", "Politics"
     - `option_yes_label` (text, default 'Yes') — label for the Yes outcome
     - `option_no_label` (text, default 'No') — label for the No outcome
     - `odds_yes` (numeric, default 0.50) — probability 0-1 for Yes
     - `odds_no` (numeric, default 0.50) — probability 0-1 for No (1 - odds_yes)
     - `end_date` (timestamptz, not null) — when the market closes
     - `status` (text, default 'active') — 'active' | 'closed' | 'resolved'
     - `resolution` (text, nullable) — 'yes' | 'no' | null, set when resolved
     - `volume` (numeric, default 0) — total trading volume
     - `created_at` (timestamptz, default now())

3. Security
   - RLS enabled on prediction_markets.
   - SELECT: anyone (anon + authenticated) can read — markets are public.
   - INSERT/UPDATE/DELETE: authenticated users only (admin panel).
*/

CREATE TABLE IF NOT EXISTS prediction_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  option_yes_label text NOT NULL DEFAULT 'Yes',
  option_no_label text NOT NULL DEFAULT 'No',
  odds_yes numeric NOT NULL DEFAULT 0.50,
  odds_no numeric NOT NULL DEFAULT 0.50,
  end_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  resolution text,
  volume numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prediction_markets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_select_all" ON prediction_markets;
CREATE POLICY "pm_select_all"
  ON prediction_markets FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "pm_insert_auth" ON prediction_markets;
CREATE POLICY "pm_insert_auth"
  ON prediction_markets FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "pm_update_auth" ON prediction_markets;
CREATE POLICY "pm_update_auth"
  ON prediction_markets FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pm_delete_auth" ON prediction_markets;
CREATE POLICY "pm_delete_auth"
  ON prediction_markets FOR DELETE
  TO authenticated
  USING (true);