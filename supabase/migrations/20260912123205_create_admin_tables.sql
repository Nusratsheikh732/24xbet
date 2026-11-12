/*
# Create admin panel tables (users, deposit/withdraw requests, game settings)

1. New Tables
- `app_users`: Stores registered users with balance, status, and metadata.
  - `id` (uuid, PK)
  - `phone` (text, unique) — phone number as login identifier
  - `name` (text) — display name
  - `balance` (numeric, default 0) — user's main balance in Taka
  - `status` (text, default 'active') — 'active' or 'banned'
  - `approved` (boolean, default true) — admin approval flag
  - `created_at` (timestamptz)
- `deposit_requests`: Tracks all deposit requests from users.
  - `id` (uuid, PK)
  - `user_id` (uuid, FK to app_users)
  - `method` (text) — 'nagad', 'bkash', 'rocket', 'binance'
  - `amount` (numeric)
  - `status` (text, default 'pending') — 'pending', 'approved', 'rejected'
  - `sender_number` (text) — the number user sent from
  - `created_at` (timestamptz)
- `withdraw_requests`: Tracks all withdrawal requests from users.
  - `id` (uuid, PK)
  - `user_id` (uuid, FK to app_users)
  - `method` (text) — 'nagad', 'bkash'
  - `amount` (numeric)
  - `account_number` (text) — destination account
  - `status` (text, default 'pending') — 'pending', 'approved', 'rejected'
  - `created_at` (timestamptz)
- `game_settings`: Stores crash game configuration (single row).
  - `id` (int, PK, default 1)
  - `early_crash_ratio` (numeric, default 0.8) — probability of early crash (under 1.5x)
  - `min_crash_mult` (numeric, default 1.01)
  - `max_early_crash` (numeric, default 1.50)
  - `max_late_crash` (numeric, default 9.50)
  - `updated_at` (timestamptz)

2. Security
- RLS enabled on all tables.
- All tables use `TO anon, authenticated` since this is a no-auth app (no sign-in screen).
  The admin panel uses a client-side password gate, not Supabase auth.
- All CRUD operations allowed for anon+authenticated on all tables.

3. Seed Data
- Inserts a default game_settings row (id=1) with the 8/10 early crash ratio.
- Inserts a demo user for testing.
*/

-- ── app_users ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  approved boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_users" ON app_users;
CREATE POLICY "anon_select_app_users" ON app_users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_users" ON app_users;
CREATE POLICY "anon_insert_app_users" ON app_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_users" ON app_users;
CREATE POLICY "anon_update_app_users" ON app_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_users" ON app_users;
CREATE POLICY "anon_delete_app_users" ON app_users FOR DELETE
  TO anon, authenticated USING (true);

-- ── deposit_requests ──────────────────────────────────
CREATE TABLE IF NOT EXISTS deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  method text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sender_number text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE deposit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_deposits" ON deposit_requests;
CREATE POLICY "anon_select_deposits" ON deposit_requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_deposits" ON deposit_requests;
CREATE POLICY "anon_insert_deposits" ON deposit_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_deposits" ON deposit_requests;
CREATE POLICY "anon_update_deposits" ON deposit_requests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_deposits" ON deposit_requests;
CREATE POLICY "anon_delete_deposits" ON deposit_requests FOR DELETE
  TO anon, authenticated USING (true);

-- ── withdraw_requests ─────────────────────────────────
CREATE TABLE IF NOT EXISTS withdraw_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  method text NOT NULL,
  amount numeric NOT NULL,
  account_number text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE withdraw_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_withdraws" ON withdraw_requests;
CREATE POLICY "anon_select_withdraws" ON withdraw_requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_withdraws" ON withdraw_requests;
CREATE POLICY "anon_insert_withdraws" ON withdraw_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_withdraws" ON withdraw_requests;
CREATE POLICY "anon_update_withdraws" ON withdraw_requests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_withdraws" ON withdraw_requests;
CREATE POLICY "anon_delete_withdraws" ON withdraw_requests FOR DELETE
  TO anon, authenticated USING (true);

-- ── game_settings ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_settings (
  id int PRIMARY KEY DEFAULT 1,
  early_crash_ratio numeric NOT NULL DEFAULT 0.8,
  min_crash_mult numeric NOT NULL DEFAULT 1.01,
  max_early_crash numeric NOT NULL DEFAULT 1.50,
  max_late_crash numeric NOT NULL DEFAULT 9.50,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE game_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON game_settings;
CREATE POLICY "anon_select_settings" ON game_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_settings" ON game_settings;
CREATE POLICY "anon_update_settings" ON game_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed default settings
INSERT INTO game_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- Seed a demo user for testing
INSERT INTO app_users (phone, name, balance)
VALUES ('01907262606', 'Adnan Sani', 5000)
  ON CONFLICT (phone) DO NOTHING;
