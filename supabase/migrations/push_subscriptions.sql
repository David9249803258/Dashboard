CREATE TABLE push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint text UNIQUE NOT NULL,
  subscription jsonb NOT NULL,
  device_label text,
  created_at timestamp DEFAULT now()
);
