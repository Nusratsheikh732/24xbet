/*
# Create prediction_bets table

1. Purpose
   Stores individual user bets on prediction markets. When a user places a
   prediction (Yes or No), a row is inserted here. When the admin resolves
   the market, a Firebase Realtime Database listener in the app reads all
   winning bets for that market and credits each user's balance.

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
     Supabase client always operates as the `anon` role. All policies are
     scoped to `anon, authenticated` — matching the pattern used by every
     other table in this project.
   - SELECT: anyone can read (needed so users can see their own bets and
     admin can see all bets).
   - INSERT: anyone can insert (a new bet from the app).
   - UPDATE: anyone can update (used to mark bets as won/lost/paid).
   - DELETE: anyone can delete (admin cleanup).
*/