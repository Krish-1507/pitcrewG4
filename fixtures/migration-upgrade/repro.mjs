// Reproduction: installing an already-applied migration set a second time
// raises "duplicate column name" because the runner ignores user_version.
// Exit 1 when the repeat migration fails, exit 0 when it is safely idempotent.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, migrate, insertUser } from './db.mjs';

const database = join(await mkdtemp(join(tmpdir(), 'migration-')), 'app.db');
const db = openDatabase(database);
try {
  migrate(db);
  insertUser(db, 'first');
  migrate(db);
  console.log('migrations are repeatable');
} catch (error) {
  console.log('repeat migration failed: ' + (error?.message ?? error));
  process.exit(1);
} finally {
  db.close();
}
