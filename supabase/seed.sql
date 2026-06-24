-- Placeholder targets — one per category.
-- Uses storage_path = 'placeholder' which the server resolves to /img/placeholder.svg.
-- Replace with real images via `bun run seed` when ready.

INSERT INTO targets (storage_path, category, attributes, caption, license, active) VALUES
  ('placeholder', 'land',      ARRAY['open', 'terrain', 'natural'],  'land · placeholder',      'internal', true),
  ('placeholder', 'water',     ARRAY['fluid', 'reflective', 'open'], 'water · placeholder',     'internal', true),
  ('placeholder', 'structure', ARRAY['built', 'geometric', 'solid'], 'structure · placeholder', 'internal', true),
  ('placeholder', 'motion',    ARRAY['dynamic', 'kinetic'],           'motion · placeholder',    'internal', true),
  ('placeholder', 'life',      ARRAY['organic', 'growing'],          'life · placeholder',      'internal', true),
  ('placeholder', 'energy',    ARRAY['luminous', 'intense'],         'energy · placeholder',    'internal', true);
