'use strict';
/**
 * Backup consistente do SQLite (VACUUM INTO) — seguro com o servidor em execução.
 * Uso:  DB_PATH=/var/data/prisma.sqlite BACKUP_DIR=/var/data/backups node scripts/backup-sqlite.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(process.env.DB_PATH || './prisma.sqlite');
const dir = process.env.BACKUP_DIR || path.join(path.dirname(dbPath), 'backups');
if (!fs.existsSync(dbPath)) { console.error('Banco não encontrado:', dbPath); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
const target = path.join(dir, 'prisma-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 5000');
db.exec("VACUUM INTO '" + target.replace(/'/g, "''") + "'");
db.close();
const check = new DatabaseSync(target, { readOnly: true });
const res = check.prepare('PRAGMA integrity_check').get();
check.close();
if (res.integrity_check !== 'ok') { console.error('Backup corrompido:', res); process.exit(2); }
const keep = Math.max(1, Number(process.env.BACKUP_KEEP || 14));
const files = fs.readdirSync(dir).filter(f => /^prisma-.*\.sqlite$/.test(f)).sort();
for (const old of files.slice(0, Math.max(0, files.length - keep))) fs.unlinkSync(path.join(dir, old));
console.log('Backup OK:', target);
