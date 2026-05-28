CREATE TABLE IF NOT EXISTS energy_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid,
  date          date NOT NULL,
  hour          integer NOT NULL CHECK (hour >= 0 AND hour <= 23),
  energy_level  integer NOT NULL CHECK (energy_level >= 1 AND energy_level <= 10),
  focus_quality integer CHECK (focus_quality >= 1 AND focus_quality <= 5),
  notes         text,
  created_at    timestamp with time zone DEFAULT now(),
  UNIQUE (date, hour)
);

CREATE INDEX IF NOT EXISTS idx_energy_logs_date ON energy_logs (date DESC);
