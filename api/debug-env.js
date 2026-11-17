/**
 * GET /api/debug-env — diagnóstico das variáveis no RUNTIME da Vercel.
 * Protegido: só responde com o cabeçalho  x-debug-token  igual a DEBUG_ENV_TOKEN.
 * Sem DEBUG_ENV_TOKEN configurado, a rota responde 404 (não existe em produção).
 * Nunca expõe valores, apenas se cada variável está definida.
 */
const crypto = require('node:crypto');
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const expected = String(process.env.DEBUG_ENV_TOKEN || '');
  const given = String(req.headers['x-debug-token'] || '');
  const a = Buffer.from(expected), b = Buffer.from(given);
  if (!expected) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: 'Não encontrado.' })); }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'Não autorizado.' }));
  }
  const keys = ['FIREBASE_API_KEY','FIREBASE_AUTH_DOMAIN','FIREBASE_PROJECT_ID','FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID','FIREBASE_APP_ID','PRISMA_BACKEND_URL','PRISMA_API_URL'];
  const present = {};
  for (const k of keys) present[k] = Boolean(String(process.env[k] || '').trim());
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, vercel: Boolean(process.env.VERCEL), vercelEnv: process.env.VERCEL_ENV || null, present }, null, 2));
};
