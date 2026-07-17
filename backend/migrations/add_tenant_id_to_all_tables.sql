-- ============================================================
-- Tenant Data Isolation Migration Script
-- Adds tenant_id column to all tables that were missing it.
-- Run this script on Supabase SQL Editor BEFORE deploying new code.
-- ============================================================

-- 1. clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);

-- 2. cases (already has tenant_id but may lack index)
CREATE INDEX IF NOT EXISTS idx_cases_tenant_id ON cases(tenant_id);

-- 3. documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);

-- 4. calendar_events
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_id ON calendar_events(tenant_id);

-- 5. time_entries
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_id ON time_entries(tenant_id);

-- 6. invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);

-- 7. expenses
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);

-- 8. employee_attendance
ALTER TABLE employee_attendance
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employee_attendance_tenant_id ON employee_attendance(tenant_id);

-- 9. employee_leaves
ALTER TABLE employee_leaves
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employee_leaves_tenant_id ON employee_leaves(tenant_id);

-- 10. employee_salaries
ALTER TABLE employee_salaries
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employee_salaries_tenant_id ON employee_salaries(tenant_id);

-- 11. firm_settings — 1 row per tenant, add unique constraint
ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_settings_tenant_id ON firm_settings(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================
-- OPTIONAL: Back-fill existing data to the first available tenant
-- (Only run this if you have existing data you want to assign)
-- ============================================================
/*
DO $$
DECLARE
  first_tenant_id UUID;
BEGIN
  SELECT id INTO first_tenant_id FROM tenants ORDER BY created_at ASC LIMIT 1;
  IF first_tenant_id IS NOT NULL THEN
    UPDATE clients         SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE cases           SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE documents       SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE calendar_events SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE time_entries    SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE invoices        SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE expenses        SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE employee_attendance SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE employee_leaves     SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE employee_salaries   SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    UPDATE firm_settings       SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
    RAISE NOTICE 'Back-filled all existing data to tenant: %', first_tenant_id;
  END IF;
END;
$$;
*/
