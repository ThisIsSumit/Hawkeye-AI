import { store } from '../services/store.js';
import { buildDefaultTelemetryChannels } from '../services/telemetryDefaults.js';
// ─── Database layer ───────────────────────────────────────────────────────────
// PostgreSQL via Prisma. Full setup instructions in README.
//
// When DATABASE_URL is not set, all routes silently fall back to the
// in-memory store — zero code changes needed to switch environments.
//
// Setup:
//   1. docker compose up -d
//   2. cp .env.example .env   (fill in OPENROUTER_API_KEY, VOYAGE_API_KEY, DATABASE_URL)
//   3. npm run db:generate    (generates Prisma client)
//   4. npm run db:push        (creates tables)
//   5. npm run dev

/* eslint-disable @typescript-eslint/no-explicit-any */

export let db: any = null;

export async function initDb(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log('[DB] No DATABASE_URL — using in-memory store. See README to enable PostgreSQL.');
    return;
  }
  try {
    // Dynamic import keeps this file compilable before `prisma generate` runs
    const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
      import('@prisma/client'),
      import('@prisma/adapter-pg'),
    ]);
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    db = new PrismaClient({ adapter, log: ['error'] });
    await (db as any).$connect();
    await (db as any).$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
    
    // Fix schema mismatch: if embedding is jsonb, convert to vector(1536)
    await (db as any).$executeRawUnsafe(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'threat_logs' 
          AND column_name = 'embedding' 
          AND data_type = 'jsonb'
        ) THEN 
          ALTER TABLE threat_logs ALTER COLUMN embedding TYPE vector(1536) USING embedding::text::vector(1536);
        END IF;
      END $$;
    `);

    await seedUsers(db);
    await ensureSettingsTables(db);
    await store.hydrate();
    console.log('[DB] PostgreSQL connected (pgvector enabled + schema verified + users seeded)');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[DB] Prisma unavailable — falling back to in-memory store:', msg);
    db = null;
  }
}

async function seedUsers(prisma: any): Promise<void> {
  if (process.env.ENABLE_DEMO_USERS !== 'true') {
    return;
  }

  const bcrypt = await import('bcryptjs');
  const users = [
    {
      id:           'usr-001',
      email:        'admin@hawkeye.ai',
      name:         'Arjun Kumar',
      passwordHash: bcrypt.default.hashSync('admin123', 10),
      role:         'ADMIN',
    },
    {
      id:           'usr-002',
      email:        'analyst@hawkeye.ai',
      name:         'Priya Sharma',
      passwordHash: bcrypt.default.hashSync('analyst123', 10),
      role:         'ANALYST',
    },
    {
      id:           'usr-003',
      email:        'viewer@hawkeye.ai',
      name:         'Dev Mehta',
      passwordHash: bcrypt.default.hashSync('viewer123', 10),
      role:         'VIEWER',
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }
}

async function ensureSettingsTables(prisma: any): Promise<void> {
  const defaultThresholds = JSON.stringify({
    sql_injection: 75,
    brute_force: 50,
    ddos: 85,
    anomaly_cutoff: 60,
    xss: 70,
  }).replaceAll("'", "''");

  const defaultTelemetry = buildDefaultTelemetryChannels();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id text PRIMARY KEY,
      name text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      value_masked text NOT NULL,
      environment text NOT NULL DEFAULT 'production',
      active boolean NOT NULL DEFAULT true,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS setting_thresholds (
      id text PRIMARY KEY,
      thresholds jsonb NOT NULL,
      updated_by text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO setting_thresholds (id, thresholds)
    VALUES ('global', '${defaultThresholds}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS telemetry_channels (
      id text PRIMARY KEY,
      label text NOT NULL,
      description text NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      config jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_by text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  for (const channel of defaultTelemetry) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO telemetry_channels (id, label, description, enabled, config)
      VALUES (
        '${channel.id.replaceAll("'", "''")}',
        '${channel.label.replaceAll("'", "''")}',
        '${channel.desc.replaceAll("'", "''")}',
        ${channel.enabled},
        '${JSON.stringify(channel.config).replaceAll("'", "''")}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS settings_audit_logs (
      id text PRIMARY KEY,
      action text NOT NULL,
      actor_id text,
      actor_role text,
      target_type text NOT NULL,
      target_id text,
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function disconnectDb(): Promise<void> {
  if (db) {
    await (db as any).$disconnect();
    db = null;
  }
}
