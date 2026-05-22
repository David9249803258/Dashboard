CREATE TABLE nutrition_logs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  date         date        NOT NULL,
  meal_type    text        NOT NULL,
  food_name    text        NOT NULL,
  portion_size text,
  calories     numeric,
  protein      numeric,
  carbs        numeric,
  fat          numeric,
  fiber        numeric,
  sodium       numeric,
  sugar        numeric,
  vitamin_c    numeric,
  iron         numeric,
  calcium      numeric,
  created_at   timestamp   DEFAULT now()
);

-- Index for fast per-day queries
CREATE INDEX nutrition_logs_date_idx ON nutrition_logs (date);
