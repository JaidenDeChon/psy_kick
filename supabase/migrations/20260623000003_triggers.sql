-- psy_kick schema migration 003: triggers
-- Enforces the two hard invariants: perception lock, and lock irreversibility.

-- ─── Lock enforcement — no writes to impressions after session is locked ─────

CREATE OR REPLACE FUNCTION enforce_session_not_locked()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM sessions
    WHERE id = NEW.session_id
      AND locked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Session is locked — impressions are read-only';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER perceptions_lock_guard
  BEFORE INSERT OR UPDATE ON session_perceptions
  FOR EACH ROW EXECUTE FUNCTION enforce_session_not_locked();

CREATE TRIGGER aol_lock_guard
  BEFORE INSERT OR UPDATE ON session_aol
  FOR EACH ROW EXECUTE FUNCTION enforce_session_not_locked();

-- Also guard notes update on sessions table
CREATE OR REPLACE FUNCTION enforce_notes_not_locked()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only block if notes changed AND session is locked
  IF OLD.locked_at IS NOT NULL AND NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Session is locked — notes are read-only';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sessions_notes_lock_guard
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_notes_not_locked();

-- ─── Lock irreversibility — locked_at can only go NULL → timestamp ───────────

CREATE OR REPLACE FUNCTION enforce_lock_irreversible()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL AND NEW.locked_at IS NULL THEN
    RAISE EXCEPTION 'Session lock is irreversible — locked_at cannot be cleared';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sessions_lock_irreversible
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_lock_irreversible();

-- ─── Auto-create profile on anonymous sign-in ────────────────────────────────
-- Handled server-side via POST /api/profile/ensure (gives us handle generation).
-- This is left empty intentionally — the application layer owns the profile row.
