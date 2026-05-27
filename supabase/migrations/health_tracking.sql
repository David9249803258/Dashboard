-- HRV and RHR daily logs
CREATE TABLE hrv_rhr_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date       date NOT NULL UNIQUE,
  hrv_ms     integer,
  rhr_bpm    integer,
  notes      text,
  created_at timestamp DEFAULT now()
);

-- Daily strain scores (logged from Gym module)
CREATE TABLE strain_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date       date NOT NULL UNIQUE,
  level      integer NOT NULL CHECK (level >= 0 AND level <= 10),
  note       text,
  created_at timestamp DEFAULT now()
);

-- Positives / Today's Wins journal
CREATE TABLE positives (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category   text NOT NULL,
  text       text NOT NULL,
  date       date NOT NULL,
  archived   boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Health patterns AI cache (keyed by ISO week)
CREATE TABLE health_patterns_cache (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_key    text NOT NULL UNIQUE,
  result      text NOT NULL,
  analyzed_at timestamp DEFAULT now()
);
