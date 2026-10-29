// SQLite storage (built into Node 22). One file, kept on a persistent volume in production.
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const C = require('../shared/catalog');

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY, name TEXT NOT NULL, name_lc TEXT NOT NULL UNIQUE, email TEXT, pass TEXT, guest INTEGER NOT NULL DEFAULT 1,
    country TEXT NOT NULL DEFAULT 'FR', elo INTEGER NOT NULL DEFAULT 1200, coins INTEGER NOT NULL DEFAULT 100, paid INTEGER NOT NULL DEFAULT 0,
    plus_until INTEGER NOT NULL DEFAULT 0, starter INTEGER NOT NULL DEFAULT 0, custom TEXT NOT NULL DEFAULT '#00D1B2',
    owned TEXT NOT NULL, eq TEXT NOT NULL, rec TEXT NOT NULL DEFAULT '{}', st TEXT NOT NULL DEFAULT '{}',
    daily_last TEXT, daily_streak INTEGER NOT NULL DEFAULT 0, stripe_customer TEXT, stripe_sub TEXT,
    created INTEGER NOT NULL, seen INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS users_elo ON users(elo DESC);
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS friends(user_id TEXT NOT NULL, friend_id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(user_id, friend_id));
  CREATE TABLE IF NOT EXISTS solo(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, level TEXT NOT NULL, ranked INTEGER NOT NULL, seed INTEGER NOT NULL, created INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY, a TEXT NOT NULL, b TEXT NOT NULL, kind TEXT NOT NULL, stake INTEGER NOT NULL, seed INTEGER NOT NULL, sa INTEGER, sb INTEGER, result REAL, created INTEGER NOT NULL, ended INTEGER);
  CREATE TABLE IF NOT EXISTS purchases(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product TEXT NOT NULL, cents INTEGER NOT NULL, created INTEGER NOT NULL);
  `);
  return db;
}

const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
function row2user(u) {
  if (!u) return null;
  const owned = Object.assign({}, C.DEFAULT_OWNED, J(u.owned, {}));
  const eq = Object.assign({}, C.DEFAULT_EQ, J(u.eq, {}));
  return Object.assign({}, u, { owned, eq, rec: Object.assign({ easy: 0, medium: 0, hard: 0 }, J(u.rec, {})), st: Object.assign({ games: 0, wins: 0, losses: 0, draws: 0, bestCombo: 0 }, J(u.st, {})) });
}
module.exports = { open, row2user, J };
