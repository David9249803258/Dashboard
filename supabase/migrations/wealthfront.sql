-- Wealthfront HYSA balance history (manual updates)
CREATE TABLE IF NOT EXISTS wealthfront_account (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  balance    numeric NOT NULL,
  apy        numeric DEFAULT 4.50,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  note       text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wealthfront_account_date ON wealthfront_account (date DESC);

-- Wealthfront transactions (deposits, withdrawals, interest)
CREATE TABLE IF NOT EXISTS wealthfront_transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date        date NOT NULL,
  amount      numeric NOT NULL,
  type        text NOT NULL CHECK (type IN ('deposit','withdrawal','interest','transfer')),
  description text,
  created_at  timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wealthfront_transactions_date ON wealthfront_transactions (date DESC);

-- RLS (single-user, allow all)
ALTER TABLE wealthfront_account      ENABLE ROW LEVEL SECURITY;
ALTER TABLE wealthfront_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "allow_all_wealthfront_account" ON wealthfront_account FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "allow_all_wealthfront_txns" ON wealthfront_transactions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
