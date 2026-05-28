-- ═══════════════════════════════════════════════════════════════════════════
-- REMAINING TABLES — all data types not yet covered by earlier migrations
-- All tables use IF NOT EXISTS so this file is safe to re-run.
-- RLS is enabled with a permissive policy for this single-user app.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── HEALTH ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sleep_logs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date           date NOT NULL UNIQUE,
  bedtime        time,
  wake_time      time,
  hours_slept    numeric,
  quality_rating integer CHECK (quality_rating BETWEEN 1 AND 5),
  notes          text,
  created_at     timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS water_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date        date NOT NULL UNIQUE,
  cups_logged numeric DEFAULT 0,
  goal        integer DEFAULT 8,
  updated_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date         date NOT NULL,
  exercise     text NOT NULL,
  sets         integer,
  reps         integer,
  weight       numeric,
  weight_unit  text DEFAULT 'lbs',
  workout_type text DEFAULT 'strength',
  notes        text,
  created_at   timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workout_logs_date ON workout_logs (date DESC);

CREATE TABLE IF NOT EXISTS body_metrics (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date        date NOT NULL UNIQUE,
  weight      numeric,
  weight_unit text DEFAULT 'lbs',
  bmi         numeric,
  body_fat    numeric,
  waist       numeric,
  chest       numeric,
  arms        numeric,
  legs        numeric,
  notes       text,
  created_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplements (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  dose        numeric,
  dose_unit   text,
  frequency   jsonb,
  time_of_day text,
  notes       text,
  active      boolean DEFAULT true,
  created_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplement_logs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplement_id  uuid REFERENCES supplements(id) ON DELETE CASCADE,
  date           date NOT NULL,
  taken_at       timestamp with time zone,
  UNIQUE (supplement_id, date)
);

-- ── NUTRITION ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nutrition_settings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key         text NOT NULL UNIQUE,
  value       jsonb,
  updated_at  timestamp with time zone DEFAULT now()
);

-- ── FINANCE ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS income_sources (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name  text NOT NULL,
  income_type  text,
  frequency    text NOT NULL,
  gross_amount numeric,
  net_amount   numeric NOT NULL,
  start_date   date NOT NULL,
  end_date     date,
  active       boolean DEFAULT true,
  notes        text,
  created_at   timestamp with time zone DEFAULT now()
);

-- Add import_id foreign key to transactions if not already present
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES import_history(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_transactions_import_id ON transactions (import_id);

-- ── PRODUCTIVITY ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  text         text NOT NULL,
  priority     text DEFAULT 'Medium',
  done         boolean DEFAULT false,
  date         date,
  category     text,
  recurring    text,
  goal_id      uuid,
  completed_at timestamp with time zone,
  created_at   timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks (date);

CREATE TABLE IF NOT EXISTS habits (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text NOT NULL,
  category       text,
  frequency      text DEFAULT 'daily',
  frequency_days jsonb,
  active         boolean DEFAULT true,
  created_at     timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id  uuid REFERENCES habits(id) ON DELETE CASCADE,
  date      date NOT NULL,
  completed boolean DEFAULT false,
  UNIQUE (habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs (date DESC);

CREATE TABLE IF NOT EXISTS journal_entries (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date             date NOT NULL UNIQUE,
  content          text,
  mood             integer CHECK (mood BETWEEN 1 AND 5),
  gratitude_prompt text,
  tags             text[],
  created_at       timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id          uuid,
  duration_minutes integer DEFAULT 25,
  completed        boolean DEFAULT true,
  focus_score      integer,
  created_at       timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_date ON pomodoro_sessions (created_at DESC);

-- ── GOALS ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goals (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text NOT NULL,
  category      text,
  description   text,
  target_date   date,
  status        text DEFAULT 'Active',
  tasks         jsonb DEFAULT '[]',
  linked_module text,
  linked_id     uuid,
  created_at    timestamp with time zone DEFAULT now()
);

-- ── APPEARANCE ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appearance_photos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_type    text NOT NULL,
  photo_url     text,
  analysis_text text,
  style_score   integer,
  uploaded_at   timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS style_memory (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_date      date NOT NULL,
  raw_analysis    text NOT NULL,
  style_score     integer,
  what_worked     text,
  what_to_improve text,
  specific_items  text,
  created_at      timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grooming_tasks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  frequency  text DEFAULT 'daily',
  active     boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grooming_logs (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id   uuid REFERENCES grooming_tasks(id) ON DELETE CASCADE,
  date      date NOT NULL,
  completed boolean DEFAULT false,
  UNIQUE (task_id, date)
);

-- ── SETTINGS ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_settings (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key        text NOT NULL UNIQUE,
  value      jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

-- ── AI / MISC ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_conversations (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key        text UNIQUE,
  data       jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — permissive for single-user app (no auth)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'sleep_logs','water_logs','workout_logs','body_metrics',
    'supplements','supplement_logs','nutrition_settings',
    'income_sources','tasks','habits','habit_logs',
    'journal_entries','pomodoro_sessions','goals',
    'appearance_photos','style_memory','grooming_tasks','grooming_logs',
    'user_settings','financial_conversations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'DO $inner$ BEGIN
         CREATE POLICY "allow_all_%1$s" ON %1$I FOR ALL USING (true) WITH CHECK (true);
       EXCEPTION WHEN duplicate_object THEN NULL;
       END $inner$', tbl
    );
  END LOOP;
END $$;
