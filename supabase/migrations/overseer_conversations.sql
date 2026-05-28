CREATE TABLE IF NOT EXISTS overseer_conversations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  created_at  timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overseer_conversations_created_at
  ON overseer_conversations (created_at DESC);
