import { DatabaseSync } from 'node:sqlite';

const migrations = [
  {
    version: 1,
    sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
  },
  {
    version: 2,
    sql: 'ALTER TABLE users ADD COLUMN email TEXT',
  },
];

export function openDatabase(path) {
  return new DatabaseSync(path);
}

export function migrate(db) {
  for (const migration of migrations) db.exec(migration.sql);
}

export function insertUser(db, name) {
  db.prepare('INSERT INTO users (name) VALUES (?)').run(name);
}
