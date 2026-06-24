-- psy_kick migration 004: storage bucket for target images
-- Creates the 'targets' bucket (private — images only served via signed URLs)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'targets',
  'targets',
  false,    -- private: never accessible without a signed URL
  5242880,  -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage: service role has full access; anon/authenticated have no direct access.
-- All image URLs are minted server-side as short-lived signed URLs (§4).
-- No client-facing storage policies needed here — signed URLs bypass RLS.
