-- psy_kick migration 006: social & crowd-judging layer
-- Adds the data foundation for crowd-judging, the global leaderboard, following,
-- and abuse reporting. The keystone invariant carries over from the session loop:
-- the true-target id is NEVER exposed to a judging client — every read that could
-- de-blind a session goes through a service-role server route.
--
-- Built on the existing `judgements` table (its schema already allowed
-- judger_id <> session owner — "schema supports friend-judging"). A SELF score is
-- a judgement where judger_id = owner; a CROWD judgement is judger_id <> owner.

-- ─── Quorum constant ─────────────────────────────────────────────────────────
-- Crowd-score stays hidden ("--"/pending) until this many INDEPENDENT (non-owner)
-- judgements exist. Mirrored in the endpoints; change in lockstep.
--   QUORUM = 5

-- ─── sessions: per-session opt-out of the public judging pool ────────────────
-- Default on (opt-out pool): a session is judgeable by others only when this is
-- true AND the owner is a cloud + verified account. Backs the §5.3 toggle.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS allow_public_scoring boolean NOT NULL DEFAULT true;

-- ─── judgements: one judgement per (session, judge) ──────────────────────────
-- Enforces "a user contributes at most one data point per session" (self-judge or
-- crowd). The owner's single self-judgement and each crowd judge's single vote all
-- coexist under this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS judgements_session_judger_key
  ON judgements (session_id, judger_id);

-- ─── is_cloud_verified ───────────────────────────────────────────────────────
-- The single gate for ALL social participation (judging, following, public
-- listing): a real cloud account (not anonymous) whose email is confirmed. OAuth
-- (Google) returns a verified email → clears on first sign-in; email/password
-- waits for the confirmation link. SECURITY DEFINER so it can read auth.users from
-- RLS policies / views running as a low-privilege role.
CREATE OR REPLACE FUNCTION public.is_cloud_verified(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = uid
      AND u.is_anonymous IS NOT TRUE
      AND u.email_confirmed_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_cloud_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cloud_verified(uuid) TO authenticated, service_role;

-- ─── follows ─────────────────────────────────────────────────────────────────
-- Both parties must be cloud + verified (enforced in the endpoint + RLS). No
-- self-follow. Unique edge.
CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- A user sees the edges they are part of (who they follow + who follows them).
CREATE POLICY "follows_party_read"
  ON follows FOR SELECT
  TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = followee_id);

CREATE POLICY "follows_own_insert"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND follower_id <> followee_id
    AND public.is_cloud_verified(follower_id)
    AND public.is_cloud_verified(followee_id)
  );

CREATE POLICY "follows_own_delete"
  ON follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- ─── reports (abuse — capture now, moderate later) ───────────────────────────
-- Append-only. No client SELECT policy → only the service role reads them.
CREATE TABLE IF NOT EXISTS reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL,           -- 'session' | 'judgement' | 'user'
  target_id   uuid NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_own_insert"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND public.is_cloud_verified(reporter_id));

-- ─── judgements: restrictive gate (defense in depth) ─────────────────────────
-- Real inserts run through the service role (bypassing RLS), but a direct client
-- insert must be a self-judge (any auth, incl. anonymous practice) OR a crowd
-- judgement by a cloud + verified account. RESTRICTIVE → ANDs with the existing
-- permissive judgements_own_insert (auth.uid() = judger_id).
CREATE POLICY "judgements_crowd_requires_verified"
  ON judgements
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = judgements.session_id
        AND s.user_id = judgements.judger_id          -- self-judge
    )
    OR public.is_cloud_verified(judgements.judger_id) -- crowd judge
  );

-- ─── session_crowd_stats (view) ──────────────────────────────────────────────
-- Per-session aggregate of INDEPENDENT (non-owner) judgements. Quorum = 5.
-- crowd_hit = quorum met AND strict majority (>50%) ranked the target #1.
-- The owner's own self-judgement is deliberately excluded from the crowd count.
CREATE OR REPLACE VIEW public.session_crowd_stats AS
WITH agg AS (
  SELECT
    s.id      AS session_id,
    s.user_id AS owner_id,
    count(j.id) FILTER (WHERE j.judger_id <> s.user_id)            AS n_judgments,
    count(j.id) FILTER (WHERE j.judger_id <> s.user_id AND j.hit)  AS n_hits
  FROM sessions s
  LEFT JOIN judgements j ON j.session_id = s.id
  GROUP BY s.id, s.user_id
)
SELECT
  session_id,
  owner_id,
  n_judgments,
  n_hits,
  CASE WHEN n_judgments > 0 THEN n_hits::numeric / n_judgments ELSE NULL END AS hit_rate,
  (n_judgments >= 5)                                   AS quorum_met,
  (n_judgments >= 5 AND n_hits * 2 > n_judgments)      AS crowd_hit
FROM agg;

-- ─── leaderboard_stats (view) ────────────────────────────────────────────────
-- Per cloud + verified operator: the count of quorum-met (eligible) sessions and
-- how many were crowd-hits. The Wilson lower bound + p-value are computed in the
-- endpoint (reusing server/utils/scoring.ts) so the stats vocabulary stays single-
-- sourced. Self-scores never appear here — standing is crowd-only.
CREATE OR REPLACE VIEW public.leaderboard_stats AS
SELECT
  cs.owner_id AS user_id,
  p.handle,
  count(*) FILTER (WHERE cs.quorum_met)                  AS n_eligible,
  count(*) FILTER (WHERE cs.quorum_met AND cs.crowd_hit) AS n_crowd_hits
FROM public.session_crowd_stats cs
JOIN public.profiles p ON p.id = cs.owner_id
WHERE public.is_cloud_verified(cs.owner_id)
GROUP BY cs.owner_id, p.handle;

-- These views aggregate across all users; serve them ONLY through service-role
-- endpoints (never let a client read the raw views).
REVOKE ALL ON public.session_crowd_stats FROM anon, authenticated;
REVOKE ALL ON public.leaderboard_stats   FROM anon, authenticated;

-- ─── review_queue (server-assigned judging pool) ─────────────────────────────
-- The judge never chooses whose session they get. Returns the sessions a given
-- judge may score, prioritising under-quorum sessions so scarce judging effort
-- flows where it is needed. Eligible = locked (immutable, perceptions final),
-- owner cloud + verified, owner opted in, not the judge's own, and not already
-- judged by this judge. SECURITY DEFINER (reads every session) → service-role only.
CREATE OR REPLACE FUNCTION public.review_queue(judge uuid)
RETURNS TABLE (session_id uuid, n_judgments bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT s.id, COALESCE(cs.n_judgments, 0) AS n_judgments
  FROM sessions s
  LEFT JOIN public.session_crowd_stats cs ON cs.session_id = s.id
  WHERE s.locked_at IS NOT NULL
    AND s.allow_public_scoring = true
    AND s.user_id <> judge
    AND public.is_cloud_verified(s.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM judgements j
      WHERE j.session_id = s.id AND j.judger_id = judge
    )
  ORDER BY COALESCE(cs.n_judgments, 0) ASC, s.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.review_queue(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_queue(uuid) TO service_role;
