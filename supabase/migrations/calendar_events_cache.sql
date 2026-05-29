CREATE TABLE IF NOT EXISTS calendar_events_cache (
  id                 text PRIMARY KEY,
  title              text,
  start_time         timestamp with time zone,
  end_time           timestamp with time zone,
  all_day            boolean DEFAULT false,
  description        text,
  color_id           text,
  source             text DEFAULT 'google',
  calendar_event_id  text,
  created_at         timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_cache_start ON calendar_events_cache (start_time DESC);

ALTER TABLE calendar_events_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "allow_all_calendar_cache" ON calendar_events_cache FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
