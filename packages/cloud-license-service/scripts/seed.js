import db from '../src/db.js'

// Seed demo activation codes for testing
const codes = [
  { code: 'DEMO30BASIC', duration_days: 30, version: 'basic' },
  { code: 'DEMO90PRO', duration_days: 90, version: 'pro' },
  { code: 'DEMO365PRO', duration_days: 365, version: 'pro' }
]

const codeList = codes.map(c => c.code)

async function seed() {
  // 1. Insert demo codes only if they don't exist yet (keep id stable so
  //    device_bindings foreign keys stay valid)
  for (const c of codes) {
    // `ON CONFLICT (code) DO NOTHING` is valid in both SQLite (>=3.24) and
    // Postgres, so the same seed works locally (sqlite) and on Supabase (pg).
    await db.prepare(`INSERT INTO activation_codes
      (code, duration_days, version, total_devices, remark)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (code) DO NOTHING`)
      .run(c.code, c.duration_days, c.version, 2, 'Demo code')
  }

  // 2. Reset any consumed demo codes back to a usable active state
  await db.prepare(`UPDATE activation_codes SET status = 'active' WHERE code IN (?, ?, ?)`)
    .run(...codeList)

  // 3. Clear device bindings so the demo codes can be activated again
  await db.prepare(`DELETE FROM device_bindings WHERE code_id IN
    (SELECT id FROM activation_codes WHERE code IN (?, ?, ?))`)
    .run(...codeList)

  console.log('Cloud license seed completed. Demo codes (reset to active):')
  codes.forEach(c => console.log(`  ${c.code} - ${c.duration_days} days - ${c.version}`))
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
