-- psy_kick schema migration 001: tables
-- Run order: schema → rls → triggers

-- ─── enums ─────────────────────────────────────────────────────────────────

CREATE TYPE target_category AS ENUM (
  'land', 'water', 'structure', 'motion', 'life', 'energy'
);

CREATE TYPE session_status AS ENUM (
  'capturing', 'locked', 'revealed', 'judged'
);

-- ─── profiles ───────────────────────────────────────────────────────────────
-- 1:1 with auth.users, created on first sign-in (including anonymous)

CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── targets ────────────────────────────────────────────────────────────────
-- Curated image pool. Every image can be target or decoy.
-- Sensitive columns (storage_path, category, attributes) are server-only.

CREATE TABLE IF NOT EXISTS targets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,
  category     target_category NOT NULL,
  attributes   text[] NOT NULL DEFAULT '{}',
  caption      text,
  license      text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── sessions ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id        uuid NOT NULL REFERENCES targets(id),  -- 🔒 server-only pre-lock
  reference_number text NOT NULL,
  status           session_status NOT NULL DEFAULT 'capturing',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  locked_at        timestamptz,   -- NULL → timestamp only, irreversible
  revealed_at      timestamptz,
  judged_at        timestamptz
);

-- ─── session_candidates ─────────────────────────────────────────────────────
-- 4 rows per session: 1 target + 3 decoys, randomised slot order.

CREATE TABLE IF NOT EXISTS session_candidates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  image_id    uuid NOT NULL REFERENCES targets(id),
  is_target   boolean NOT NULL DEFAULT false,  -- 🔒 withheld until scoring
  slot        int NOT NULL,                     -- randomised presentation order
  judged_rank int                               -- 1-4, filled at judge
);

-- ─── session_perceptions — THE SIGNAL ───────────────────────────────────────
-- Separated sensory fields. Signal/noise split is structural, not just visual.

CREATE TABLE IF NOT EXISTS session_perceptions (
  session_id      uuid PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  gestalt_tags    text[] NOT NULL DEFAULT '{}',
  sensory         jsonb NOT NULL DEFAULT '{}',  -- {color, texture, temp, sound, smell, taste}
  dimensional_tags text[] NOT NULL DEFAULT '{}',
  ideogram        jsonb NOT NULL DEFAULT '[]',  -- stroke[]
  sketch          jsonb NOT NULL DEFAULT '[]'   -- stroke[]
);

-- ─── session_aol — THE NOISE ─────────────────────────────────────────────────
-- Analytic overlay: separate table enforces the signal/noise distinction.

CREATE TABLE IF NOT EXISTS session_aol (
  session_id uuid PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  entries    jsonb NOT NULL DEFAULT '[]'
);

-- ─── judgements ─────────────────────────────────────────────────────────────
-- judger_id may ≠ user_id — schema supports friend-judging (v1 UI omits it).

CREATE TABLE IF NOT EXISTS judgements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  judger_id  uuid NOT NULL REFERENCES profiles(id),
  ranking    jsonb NOT NULL DEFAULT '{}',   -- { candidate_id → rank }
  hit        boolean NOT NULL DEFAULT false, -- computed server-side
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS sessions_user_id_idx     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_status_idx       ON sessions(status);
CREATE INDEX IF NOT EXISTS candidates_session_id_idx ON session_candidates(session_id);
CREATE INDEX IF NOT EXISTS judgements_session_id_idx ON judgements(session_id);
CREATE INDEX IF NOT EXISTS judgements_judger_id_idx  ON judgements(judger_id);
