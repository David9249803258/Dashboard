-- Custom foods saved by user after manual nutrition entry
CREATE TABLE custom_foods (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  calories   numeric,
  protein    numeric,
  carbs      numeric,
  fat        numeric,
  fiber      numeric,
  sodium     numeric,
  sugar      numeric,
  vitamin_c  numeric,
  iron       numeric,
  calcium    numeric,
  created_at timestamp DEFAULT now()
);

-- Workout routines
CREATE TABLE routines (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  exercises  jsonb NOT NULL DEFAULT '[]',
  created_at timestamp DEFAULT now()
);

-- Appearance photo analyses
CREATE TABLE appearance_analyses (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id    text NOT NULL,
  analysis    text NOT NULL,
  created_at  timestamp DEFAULT now()
);
