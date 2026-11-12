/*
# Create support chat tables

1. New Tables
- `support_messages`: individual chat messages between users and admin.
  - `id` (uuid, primary key)
  - `user_id` (text, not null) — Firebase UID of the user
  - `user_name` (text)
  - `user_phone` (text)
  - `sender` (text: 'user' | 'admin')
  - `text` (text, not null)
  - `status` (text: 'open' | 'resolved') — only meaningful for user-originated messages; admin replies default to 'open'
  - `created_at` (bigint, millis epoch) — matches existing Firebase timestamp format
- `support_conversations`: one row per user, denormalized for the admin inbox list.
  - `user_id` (text, primary key)
  - `user_name` (text)
  - `user_phone` (text)
  - `last_message` (text)
  - `last_at` (bigint, millis epoch)
  - `status` (text: 'open' | 'resolved')
  - `updated_at` (timestamptz)
2. Security
- Enable RLS on both tables.
- Allow anon + authenticated full CRUD: the app authenticates via Firebase (not Supabase Auth), so the browser always runs as the anon role. Restricting to `authenticated` would make the tables invisible to the app.
3. Indexes
- `support_messages(user_id, created_at)` — for loading a conversation ordered by time.
- `support_conversations(last_at desc)` — for the admin inbox sorted by most recent.
4. Notes
- `user_id` is text (Firebase UID), not a uuid FK to auth.users, because auth is handled by Firebase.
- `created_at` is bigint milliseconds to match the existing Firestore `Date.now()` convention used throughout the app.
*/

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_name text DEFAULT '',
  user_phone text DEFAULT '',
  sender text NOT NULL DEFAULT 'user',
  text text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_support_messages" ON support_messages;
CREATE POLICY "anon_select_support_messages" ON support_messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_support_messages" ON support_messages;
CREATE POLICY "anon_insert_support_messages" ON support_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_support_messages" ON support_messages;
CREATE POLICY "anon_update_support_messages" ON support_messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_support_messages" ON support_messages;
CREATE POLICY "anon_delete_support_messages" ON support_messages FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_support_messages_user_created
  ON support_messages (user_id, created_at);

CREATE TABLE IF NOT EXISTS support_conversations (
  user_id text PRIMARY KEY,
  user_name text DEFAULT '',
  user_phone text DEFAULT '',
  last_message text DEFAULT '',
  last_at bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_support_conversations" ON support_conversations;
CREATE POLICY "anon_select_support_conversations" ON support_conversations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_support_conversations" ON support_conversations;
CREATE POLICY "anon_insert_support_conversations" ON support_conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_support_conversations" ON support_conversations;
CREATE POLICY "anon_update_support_conversations" ON support_conversations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_support_conversations" ON support_conversations;
CREATE POLICY "anon_delete_support_conversations" ON support_conversations FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_support_conversations_last_at
  ON support_conversations (last_at DESC);