-- Pet Store License Service — Supabase / Postgres schema
-- Run this ONCE in the Supabase SQL editor (or via `supabase db push`).
-- Mirrors the local SQLite tables in src/db.js, ported to Postgres dialect.

CREATE TABLE IF NOT EXISTS activation_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL,
  version TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'active',
  total_devices INTEGER NOT NULL DEFAULT 2,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS device_bindings (
  id SERIAL PRIMARY KEY,
  code_id INTEGER NOT NULL REFERENCES activation_codes(id),
  machine_id TEXT NOT NULL,
  hardware_info TEXT,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS heartbeat_logs (
  id SERIAL PRIMARY KEY,
  device_binding_id INTEGER NOT NULL REFERENCES device_bindings(id),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result TEXT
);

CREATE INDEX IF NOT EXISTS idx_device_bindings_machine ON device_bindings(machine_id);
CREATE INDEX IF NOT EXISTS idx_device_bindings_code ON device_bindings(code_id);

-- This backend connects with the service_role key (server-side only), which
-- bypasses RLS. Enabling RLS + a service_role policy adds defense-in-depth so
-- the anon key can never read or write these tables even if it is leaked.
ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access" ON activation_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access" ON device_bindings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access" ON heartbeat_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
