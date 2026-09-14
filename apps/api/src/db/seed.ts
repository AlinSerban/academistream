import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { tenants, users, tenantMemberships } from '@academistream/db';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';
const PLATFORM_EMAIL =
  process.env.SEED_PLATFORM_EMAIL ?? 'platform@academistream.local';

/** Demo-tight defaults — override with SEED_MAX_USERS / SEED_MAX_VIDEOS. */
const SEED_MAX_USERS = readPositiveInt(process.env.SEED_MAX_USERS, 20);
const SEED_MAX_VIDEOS = readPositiveInt(process.env.SEED_MAX_VIDEOS, 8);

type MembershipRole = 'tenant_admin' | 'instructor' | 'learner';

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

async function getOrCreateUser(
  db: ReturnType<typeof drizzle>,
  input: {
    email: string;
    name: string;
    passwordHash: string;
    isPlatformAdmin?: boolean;
  },
) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      isPlatformAdmin: input.isPlatformAdmin ?? false,
    })
    .returning();

  return created;
}

async function getOrCreateTenant(
  db: ReturnType<typeof drizzle>,
  name: string,
) {
  const existing = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, name))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(tenants)
      .set({
        maxUsers: SEED_MAX_USERS,
        maxVideos: SEED_MAX_VIDEOS,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, existing[0].id))
      .returning();
    return updated ?? existing[0];
  }

  const [created] = await db
    .insert(tenants)
    .values({
      name,
      maxUsers: SEED_MAX_USERS,
      maxVideos: SEED_MAX_VIDEOS,
    })
    .returning();
  return created;
}

async function ensureMembership(
  db: ReturnType<typeof drizzle>,
  userId: number,
  tenantId: number,
  role: MembershipRole,
) {
  const existing = await db
    .select()
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return;
  }

  await db.insert(tenantMemberships).values({ userId, tenantId, role });
}

async function seedTenant(
  db: ReturnType<typeof drizzle>,
  passwordHash: string,
  tenantName: string,
  slug: string,
) {
  const tenant = await getOrCreateTenant(db, tenantName);

  const admin = await getOrCreateUser(db, {
    email: `admin@${slug}.local`,
    name: `${tenantName} Admin`,
    passwordHash,
  });
  const instructor = await getOrCreateUser(db, {
    email: `instructor@${slug}.local`,
    name: `${tenantName} Instructor`,
    passwordHash,
  });
  const learner = await getOrCreateUser(db, {
    email: `learner@${slug}.local`,
    name: `${tenantName} Learner`,
    passwordHash,
  });

  await ensureMembership(db, admin.id, tenant.id, 'tenant_admin');
  await ensureMembership(db, instructor.id, tenant.id, 'instructor');
  await ensureMembership(db, learner.id, tenant.id, 'learner');

  return tenant;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool });
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  await getOrCreateUser(db, {
    email: PLATFORM_EMAIL,
    name: 'Platform Admin',
    passwordHash,
    isPlatformAdmin: true,
  });

  const acme = await seedTenant(db, passwordHash, 'Acme', 'acme');
  const globex = await seedTenant(db, passwordHash, 'Globex', 'globex');

  console.log('Seed complete (idempotent; existing emails were skipped).');
  console.log(
    `Tenant quotas applied: maxUsers=${SEED_MAX_USERS}, maxVideos=${SEED_MAX_VIDEOS} (Acme #${acme.id}, Globex #${globex.id}).`,
  );
  console.log(`Platform admin: ${PLATFORM_EMAIL}`);
  console.log('Tenant admins: admin@acme.local, admin@globex.local');
  console.log('Also seeded instructor + learner per tenant.');
  console.log(`Password (all seed users): ${SEED_PASSWORD}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
