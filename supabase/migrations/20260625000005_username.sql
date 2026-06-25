-- ─── usernames ────────────────────────────────────────────────────────────────
-- `profiles.handle` becomes the user-chosen PUBLIC username (the only identity
-- other users ever see). Email stays private. Enforce case-insensitive uniqueness
-- and a simple format.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_lower_key ON profiles (lower(handle));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_handle_format;
ALTER TABLE profiles ADD CONSTRAINT profiles_handle_format
  CHECK (handle ~ '^[A-Za-z0-9_]{3,20}$');

-- Resolve a login identity (username OR email) to the account email, server-side
-- only. SECURITY DEFINER so it can read auth.users + profiles; granted to
-- service_role exclusively so clients can never enumerate usernames → emails.
CREATE OR REPLACE FUNCTION public.email_by_identity(ident text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(p.handle) = lower(ident)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.email_by_identity(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_by_identity(text) TO service_role;
