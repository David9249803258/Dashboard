CREATE TABLE IF NOT EXISTS dismissed_detections (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  detection_id     text NOT NULL,
  dismissed_until  timestamp with time zone NOT NULL,
  created_at       timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dismissed_detection_id ON dismissed_detections (detection_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_until        ON dismissed_detections (dismissed_until DESC);

ALTER TABLE dismissed_detections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "allow_all_dismissed_detections"
    ON dismissed_detections FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
