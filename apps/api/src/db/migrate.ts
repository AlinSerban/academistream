import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool });

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, '../../drizzle'),
  });

  console.log('Migrations applied successfully');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
