-- psy_kick schema migration 002: row-level security
-- Guards who can read what. Sensitive 🔒 columns are never in client-visible policies.

-- Enable RLS on all user-data tables
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_candidates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_perceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_aol         ENABLE ROW LEVEL SECURITY;
ALTER TABLE judgements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets             ENABLE ROW LEVEL SECURITY;

-- ─── targets ────────────────────────────────────────────────────────────────
-- Authenticated users can read active targets (but NOT storage_path, category,
-- attributes via this policy — those columns require a service-role read).
-- In practice, clients never query targets directly; server routes handle all reads.

CREATE POLICY "targets_authenticated_read"
  ON targets FOR SELECT
  TO authenticated
  USING (active = true);

-- ─── profiles ───────────────────────────────────────────────────────────────

CREATE POLICY "profiles_own_read"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_own_insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_own_update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── sessions ───────────────────────────────────────────────────────────────
-- target_id is in sessions but clients must never query it pre-lock.
-- The server uses the service role to read target_id.

CREATE POLICY "sessions_own_read"
  ON sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "sessions_own_insert"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_own_update"
  ON sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── session_candidates ─────────────────────────────────────────────────────
-- Clients can read candidate rows for their own sessions, but is_target is
-- withheld by application logic (never queried directly by client).

CREATE POLICY "candidates_own_read"
  ON session_candidates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE id = session_candidates.session_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "candidates_own_insert"
  ON session_candidates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE id = session_candidates.session_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "candidates_own_update"
  ON session_candidates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE id = session_candidates.session_id
        AND user_id = auth.uid()
    )
  );

-- ─── session_perceptions ─────────────────────────────────────────────────────

CREATE POLICY "perceptions_own_read"
  ON session_perceptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE id = session_perceptions.session_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "perceptions_own_write"
  ON session_perceptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE id = session_perceptions.session_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "perceptions_own_update"
  ON session_perceptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE id = session_perceptions.session_id
        AND user_id = auth.uid()
    )
  );

-- ─── session_aol ─────────────────────────────────────────────────────────────

CREATE POLICY "aol_own_read"
  ON session_aol FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE id = session_aol.session_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "aol_own_write"
  ON session_aol FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE id = session_aol.session_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "aol_own_update"
  ON session_aol FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE id = session_aol.session_id
        AND user_id = auth.uid()
    )
  );

-- ─── judgements ──────────────────────────────────────────────────────────────

CREATE POLICY "judgements_own_read"
  ON judgements FOR SELECT
  TO authenticated
  USING (
    auth.uid() = judger_id
    OR EXISTS (
      SELECT 1 FROM sessions
      WHERE id = judgements.session_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "judgements_own_insert"
  ON judgements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = judger_id);
