-- Universal key-value store — replaces app_data as the generic module storage.
-- No per-device isolation; single-user app shares one namespace.
CREATE TABLE IF NOT EXISTS module_data (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key        text UNIQUE NOT NULL,
  value      jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_data_key ON module_data (key);

-- Disable RLS (single-user app, no auth required)
ALTER TABLE module_data DISABLE ROW LEVEL SECURITY;

-- Migrate existing app_data rows into module_data (run once)
-- This copies every row so nothing is lost during the transition.
INSERT INTO module_data (key, value, updated_at)
SELECT key, payload, updated_at
FROM   app_data
ON CONFLICT (key) DO UPDATE
  SET value      = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at;
