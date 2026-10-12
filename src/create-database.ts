import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function getPostgresToolPath(tool: string) {
  const prefix = spawnSync('brew', ['--prefix', 'postgresql@16'], { encoding: 'utf8' });
  if (prefix.status === 0) {
    const candidate = join(prefix.stdout.trim(), 'bin', tool);
    if (existsSync(candidate)) return candidate;
  }
  return tool;
}

function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is missing. Set it in server/.env first.');

  const databaseUrl = new URL(connectionString);
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
  if (!databaseName) throw new Error('DATABASE_URL must include a database name.');

  const args = [
    '--host', databaseUrl.hostname || 'localhost',
    '--port', databaseUrl.port || '5432',
    '--username', decodeURIComponent(databaseUrl.username || process.env.USER || ''),
  ];
  const environment = { ...process.env };
  if (databaseUrl.password) environment.PGPASSWORD = decodeURIComponent(databaseUrl.password);

  const escapedName = databaseName.replaceAll("'", "''");
  const lookup = spawnSync(getPostgresToolPath('psql'), [
    ...args,
    '--dbname', 'postgres',
    '--tuples-only',
    '--no-align',
    '--command', `SELECT 1 FROM pg_database WHERE datname = '${escapedName}'`,
  ], { encoding: 'utf8', env: environment });
  if (lookup.error) throw lookup.error;
  if (lookup.status !== 0) {
    throw new Error(lookup.stderr.trim() || 'Could not query the PostgreSQL server.');
  }
  if (lookup.stdout.trim() === '1') {
    console.log(`Database "${databaseName}" already exists.`);
    return;
  }

  const result = spawnSync(getPostgresToolPath('createdb'), [...args, databaseName], { env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

try {
  main();
} catch (error) {
  console.error('Database creation failed:', error);
  process.exitCode = 1;
}
