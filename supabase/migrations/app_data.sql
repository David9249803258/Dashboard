-- Generic key-value store used by the app for all module data.
-- device_id is now always 'hdash' (single-user app — no per-device isolation needed).
-- Previously it stored a per-device UUID, which broke cross-device access.

CREATE TABLE IF NOT EXISTS app_data (
  device_id   text NOT NULL,
  key         text NOT NULL,
  payload     jsonb,
  updated_at  timestamp with time zone DEFAULT now(),
  PRIMARY KEY (device_id, key)
);

CREATE INDEX IF NOT EXISTS idx_app_data_key ON app_data (key);

-- ── Data consolidation (run manually once in Supabase SQL editor) ─────────────
-- If you have existing data stored under old per-device UUIDs, run these two
-- statements to consolidate everything under the shared 'hdash' key so any
-- device can read it:
--
-- UPDATE app_data SET device_id = 'hdash' WHERE device_id <> 'hdash';
--
-- DELETE FROM app_data a USING app_data b
--   WHERE a.device_id = b.device_id
--     AND a.key = b.key
--     AND a.updated_at < b.updated_at;
--
-- After running, all devices will share the same data automatically.

-- RLS: allow all operations (single-user app, no auth required)
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "allow_all_app_data"
  ON app_data FOR ALL USING (true) WITH CHECK (true);
