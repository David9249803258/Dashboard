-- ── Financial accounts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_accounts (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                 text NOT NULL,
  type                 text NOT NULL DEFAULT 'checking',
  institution          text,
  balance              numeric DEFAULT 0,
  previous_balance     numeric DEFAULT 0,
  balance_date         date DEFAULT CURRENT_DATE,
  account_number_last4 text,
  is_asset             boolean DEFAULT true,
  currency             text DEFAULT 'USD',
  color                text,
  notes                text,
  active               boolean DEFAULT true,
  created_at           timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_active ON financial_accounts (active);

ALTER TABLE financial_accounts DISABLE ROW LEVEL SECURITY;

-- ── Account balance history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_balance_history (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id       uuid REFERENCES financial_accounts(id) ON DELETE CASCADE,
  balance          numeric NOT NULL,
  previous_balance numeric,
  change_amount    numeric,
  change_date      date DEFAULT CURRENT_DATE,
  note             text,
  created_at       timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_balance_history_account ON account_balance_history (account_id, change_date DESC);

ALTER TABLE account_balance_history DISABLE ROW LEVEL SECURITY;

-- ── Extend transactions with transfer detection ────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_transfer      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_account text;

CREATE INDEX IF NOT EXISTS idx_transactions_is_transfer ON transactions (is_transfer);

-- Retroactively mark known transfer merchants
UPDATE transactions SET
  is_transfer      = true,
  category         = 'Transfer',
  type             = 'transfer'
WHERE
  merchant ILIKE '%wealthfront%' OR
  merchant ILIKE '%webull%'       OR
  merchant ILIKE '%zelle%'        OR
  merchant ILIKE '%capital one transfer%' OR
  (merchant ILIKE '%transfer%' AND merchant NOT ILIKE '%transferred%');
