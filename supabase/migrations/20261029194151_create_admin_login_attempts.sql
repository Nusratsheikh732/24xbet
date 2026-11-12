/*
# Create admin login attempts table (rate limiting for the admin password gate)

1. New Tables
- `admin_login_attempts`
  - `client_key` (text, primary key) - hashed client identifier (never the raw IP)
  - `failed_count` (int) - consecutive failed password attempts
  - `locked_until` (timestamptz, nullable) - when a lockout ends
  - `updated_at` (timestamptz)

2. Security
- RLS enabled with no policies, so anon and authenticated roles cannot read or write.
- Only `service_role` (used by the admin-login edge function) is granted access.

3. Notes
- Lockout is enforced server-side in the admin-login edge function.
*/

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  client_key text PRIMARY KEY,
  failed_count int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON admin_login_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_login_attempts TO service_role;
