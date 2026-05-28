-- Import history table (tracks each batch import)
CREATE TABLE IF NOT EXISTS import_history (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name             text NOT NULL,
  file_type             text,
  date_range_start      date,
  date_range_end        date,
  transactions_imported integer DEFAULT 0,
  duplicates_skipped    integer DEFAULT 0,
  imported_at           timestamp with time zone DEFAULT now()
);

-- Add import_id to transactions so we can cascade-delete by import batch
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES import_history(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_transactions_import_id ON transactions(import_id);
