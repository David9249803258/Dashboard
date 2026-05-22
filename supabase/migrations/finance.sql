CREATE TABLE transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  merchant text,
  note text,
  source text DEFAULT 'manual',
  created_at timestamp DEFAULT now()
);

CREATE TABLE budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  monthly_limit numeric NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE savings_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric DEFAULT 0,
  target_date date,
  category text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE debts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  balance numeric NOT NULL,
  interest_rate numeric,
  minimum_payment numeric,
  type text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE net_worth_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assets jsonb,
  liabilities jsonb,
  total_assets numeric,
  total_liabilities numeric,
  net_worth numeric,
  recorded_at date DEFAULT now()
);

CREATE TABLE subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  amount numeric NOT NULL,
  billing_cycle text NOT NULL,
  category text,
  last_charged date,
  next_charge date,
  active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

CREATE TABLE bills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  paid boolean DEFAULT false,
  recurring boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE INDEX transactions_date_idx ON transactions (date);
CREATE INDEX transactions_type_idx ON transactions (type);
CREATE INDEX bills_due_date_idx ON bills (due_date);
