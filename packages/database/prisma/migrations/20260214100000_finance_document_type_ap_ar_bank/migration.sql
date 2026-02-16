-- Finance schema: document type, certification link, retention/adjustment, BankAccount, Payment.bankAccountId
-- Idempotent: safe to run multiple times (checks information_schema / existence before creating).

-- 1. finance_transactions: add columns if missing (PG 9.5 compatible)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'finance_transactions' AND column_name = 'certification_id') THEN
    ALTER TABLE finance.finance_transactions ADD COLUMN certification_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'finance_transactions' AND column_name = 'document_type') THEN
    ALTER TABLE finance.finance_transactions ADD COLUMN document_type TEXT NOT NULL DEFAULT 'INVOICE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'finance_transactions' AND column_name = 'retention_amount') THEN
    ALTER TABLE finance.finance_transactions ADD COLUMN retention_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'finance_transactions' AND column_name = 'adjustment_amount') THEN
    ALTER TABLE finance.finance_transactions ADD COLUMN adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'finance_transactions' AND column_name = 'adjustment_notes') THEN
    ALTER TABLE finance.finance_transactions ADD COLUMN adjustment_notes TEXT;
  END IF;
END $$;

-- 2. Indexes (idempotent: CREATE INDEX IF NOT EXISTS exists in PG 9.5+)
CREATE INDEX IF NOT EXISTS finance_transactions_due_date_idx ON finance.finance_transactions(due_date);
CREATE INDEX IF NOT EXISTS finance_transactions_certification_id_idx ON finance.finance_transactions(certification_id);

-- 3. FK certification (drop if exists then add)
ALTER TABLE finance.finance_transactions DROP CONSTRAINT IF EXISTS finance_transactions_certification_id_fkey;
ALTER TABLE finance.finance_transactions ADD CONSTRAINT finance_transactions_certification_id_fkey
  FOREIGN KEY (certification_id) REFERENCES public.certifications(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. bank_accounts table (only if not exists)
CREATE TABLE IF NOT EXISTS finance.bank_accounts (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_number TEXT,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT bank_accounts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS bank_accounts_org_id_idx ON finance.bank_accounts(org_id);

ALTER TABLE finance.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_org_id_fkey;
ALTER TABLE finance.bank_accounts ADD CONSTRAINT bank_accounts_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. payments: bank_account_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'payments' AND column_name = 'bank_account_id') THEN
    ALTER TABLE finance.payments ADD COLUMN bank_account_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payments_bank_account_id_idx ON finance.payments(bank_account_id);

ALTER TABLE finance.payments DROP CONSTRAINT IF EXISTS payments_bank_account_id_fkey;
ALTER TABLE finance.payments ADD CONSTRAINT payments_bank_account_id_fkey
  FOREIGN KEY (bank_account_id) REFERENCES finance.bank_accounts(id) ON DELETE SET NULL ON UPDATE CASCADE;
