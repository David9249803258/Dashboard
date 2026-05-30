-- Expand nutrition_logs with full micronutrient tracking and source tracking
ALTER TABLE nutrition_logs
  ADD COLUMN IF NOT EXISTS vitamin_d_mcg   numeric,
  ADD COLUMN IF NOT EXISTS vitamin_b12_mcg numeric,
  ADD COLUMN IF NOT EXISTS potassium_mg    numeric,
  ADD COLUMN IF NOT EXISTS magnesium_mg    numeric,
  ADD COLUMN IF NOT EXISTS zinc_mg         numeric,
  ADD COLUMN IF NOT EXISTS omega3_g        numeric,
  ADD COLUMN IF NOT EXISTS source          text DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_source ON nutrition_logs (source);
