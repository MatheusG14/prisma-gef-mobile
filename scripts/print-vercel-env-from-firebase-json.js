#!/usr/bin/env node
'use strict';
/**
 * Uso:
 *   node scripts/print-vercel-env-from-firebase-json.js
 * Cole o objeto firebaseConfig (JSON) e encerre com Ctrl+D (Linux/Mac) ou Ctrl+Z (Windows).
 *
 * Ou:
 *   node scripts/print-vercel-env-from-firebase-json.js '{"apiKey":"...","authDomain":"...", ...}'
 */
let raw = process.argv[2];
if (!raw) {
  console.error('Cole o JSON do firebaseConfig e pressione Ctrl+D:');
  raw = require('fs').readFileSync(0, 'utf8');
}
raw = raw.trim();
// permite colar com "const firebaseConfig = {...};"
const m = raw.match(/\{[\s\S]*\}/);
if (!m) {
  console.error('JSON não encontrado.');
  process.exit(1);
}
let cfg;
try {
  cfg = Function('return (' + m[0] + ')')();
} catch (e) {
  console.error('JSON inválido:', e.message);
  process.exit(1);
}
const map = {
  FIREBASE_API_KEY: cfg.apiKey,
  FIREBASE_AUTH_DOMAIN: cfg.authDomain,
  FIREBASE_PROJECT_ID: cfg.projectId,
  FIREBASE_STORAGE_BUCKET: cfg.storageBucket,
  FIREBASE_MESSAGING_SENDER_ID: cfg.messagingSenderId,
  FIREBASE_APP_ID: cfg.appId
};
console.log('\n# Cole na Vercel → Environment Variables:\n');
for (const [k, v] of Object.entries(map)) {
  if (!v) console.log(`# FALTANDO: ${k}`);
  else console.log(`${k}=${v}`);
}
console.log('\n# CLI Vercel (exemplo):');
for (const [k, v] of Object.entries(map)) {
  if (v) console.log(`echo "${v}" | vercel env add ${k} production`);
}
