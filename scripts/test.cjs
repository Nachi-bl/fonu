const { config } = require('dotenv');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
config({ path: resolve(__dirname, '../.env') });
const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!base) throw new Error('Configure TEST_DATABASE_URL or DATABASE_URL');
const schema = 'inventory_test_' + randomBytes(8).toString('hex');
const url = new URL(base);
url.searchParams.set('schema', schema);
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  TEST_DATABASE_URL: url.toString(),
  JWT_SECRET: process.env.JWT_SECRET || randomBytes(32).toString('hex'),
};
const cwd = resolve(__dirname, '../apps/api');
function run(file, args, overrides = {}) {
  return (
    spawnSync(process.execPath, [resolve(__dirname, '../node_modules', file), ...args], {
      cwd,
      env: { ...env, ...overrides },
      stdio: 'inherit',
    }).status ?? 1
  );
}
(async () => {
  let code = run('prisma/build/index.js', ['migrate', 'deploy']);
  if (!code) code = run('jest/bin/jest.js', ['--runInBand'], { DATABASE_URL: base });
  process.env.DATABASE_URL = url.toString();
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } catch {
    console.error('Test schema cleanup failed: ' + schema);
    code = 1;
  } finally {
    await db.$disconnect();
  }
  process.exitCode = code;
})();
