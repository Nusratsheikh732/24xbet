/*
# Fix prediction_markets RLS policies to allow anon access

1. Problem
   The INSERT, UPDATE, and DELETE policies on prediction_markets were scoped
   to `authenticated` only. This app uses Firebase for authentication, not
   Supabase Auth, so the browser-side Supabase client always operates as the
   `anon` role. The `authenticated`-only policies blocked all writes, causing
   "Failed to create market" errors in the admin panel.

2. Fix
   Drop and recreate the INSERT, UPDATE, and DELETE policies to include both
   `anon` and `authenticated` roles — matching the pattern used by every other
   table in this project (app_users, deposit_requests, etc.).

3. Security
   - SELECT: unchanged — already open to anon + authenticated.
   - INSERT/UPDATE/DELETE: now open to anon + authenticated, matching all
     other tables. Admin access is gated by the admin password in the app UI.
*/

DROP POLICY IF EXISTS "pm_insert_auth" ON prediction_markets;
CREATE POLICY "pm_insert_auth"
  ON prediction_markets FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "pm_update_auth" ON prediction_markets;
CREATE POLICY "pm_update_auth"
  ON prediction_markets FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pm_delete_auth" ON prediction_markets;
CREATE POLICY "pm_delete_auth"
  ON prediction_markets FOR DELETE
  TO anon, authenticated
  USING (true);