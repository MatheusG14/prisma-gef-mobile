'use strict';
/**
 * Testes de produção do Prisma GEF — executam o server.js REAL como processo filho
 * (NODE_ENV=production, banco SQLite em arquivo, porta efêmera), sem mocks de banco.
 * O único elemento simulado é o provedor de chaves do Firebase: um servidor JWKS local
 * publica uma chave RSA gerada no teste, permitindo assinar ID tokens e validar de verdade
 * assinatura/aud/iss/exp no backend. Não prova a integração com o Firebase real.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PROJECT = 'prisma-gef-test';
const ORIGIN_OK = 'https://prisma-test.vercel.app';
// fora de /tmp de propósito: em produção o server recusa banco em armazenamento temporário
const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-test-'));

// ── chaves/JWKS locais ──────────────────────────────────────────────────────
const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-kid-1';
let jwksServer, jwksUrl;

function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function makeToken(claims = {}, { key = kp.privateKey, kid = KID, alg = 'RS256' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/' + PROJECT, aud: PROJECT, sub: 'uid-' + crypto.randomUUID(),
    iat: now - 10, exp: now + 3600, auth_time: now - 10,
    email: 'user-' + crypto.randomUUID().slice(0, 8) + '@example.com', email_verified: true, name: 'Teste', ...claims
  };
  const head = b64({ alg, kid, typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), key).toString('base64url');
  return head + '.' + body + '.' + sig;
}

function freePort() {
  return new Promise((resolve) => {
    const s = http.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

function req(port, method, p, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let json = null; try { json = JSON.parse(raw.toString()); } catch (_) { }
        resolve({ status: res.statusCode, headers: res.headers, json, raw });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function startBackend(extraEnv = {}) {
  const port = await freePort();
  const env = {
    PATH: process.env.PATH, NODE_ENV: 'production', PORT: String(port),
    DB_PATH: path.join(tmp, 'main.sqlite'), ALLOWED_ORIGINS: ORIGIN_OK, TRUST_PROXY_HOPS: '2',
    FIREBASE_PROJECT_ID: PROJECT, FIREBASE_JWKS_URL: jwksUrl, WAF_AUTH_RATE_MAX: '1000', WAF_API_RATE_MAX: '1000',
    APP_BASE_URL: ORIGIN_OK, ...extraEnv
  };
  const proc = spawn(process.execPath, ['server.js'], { cwd: ROOT, env });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  const exited = new Promise((r) => proc.on('exit', (code, sig) => r({ code, sig })));
  for (let i = 0; i < 60; i++) {
    try { const h = await req(port, 'GET', '/api/health'); if (h.status === 200) return { port, proc, exited, log: () => log }; } catch (_) { }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill('SIGKILL');
  throw new Error('backend não subiu:\n' + log);
}

async function stop(b) { b.proc.kill('SIGTERM'); return b.exited; }
const bearer = (t, extra = {}) => ({ headers: { Authorization: 'Bearer ' + t, ...extra } });

let main;
test.before(async () => {
  jwksServer = http.createServer((q, s) => {
    const jwk = { ...kp.publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' };
    s.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' });
    s.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((r) => jwksServer.listen(0, '127.0.0.1', r));
  jwksUrl = 'http://127.0.0.1:' + jwksServer.address().port + '/jwks';
  main = await startBackend();
});
test.after(async () => {
  if (main) await stop(main);
  jwksServer.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('inicialização: produção exige DB_PATH e recusa diretório temporário', () => {
  const run = (env) => spawnSync(process.execPath, ['server.js'], { cwd: ROOT, env: { PATH: process.env.PATH, NODE_ENV: 'production', PORT: '0', ...env }, timeout: 8000 });
  const a = run({});
  assert.notEqual(a.status, 0);
  assert.match(String(a.stderr), /DB_PATH é obrigatório/);
  const b = run({ DB_PATH: '/tmp/x/prisma.sqlite' });
  assert.notEqual(b.status, 0);
  assert.match(String(b.stderr), /armazenamento temporário/);
});

test('health check: banco OK, migrações aplicadas e sem vazar caminho do banco', async () => {
  const h = await req(main.port, 'GET', '/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.json.ok, true);
  assert.equal(h.json.databaseOk, true);
  assert.equal(h.json.schemaVersion, 2);
  assert.equal(h.json.databasePath, undefined);
  assert.ok(!h.raw.toString().includes(tmp));
  assert.equal(h.headers['strict-transport-security'] !== undefined, true);
});

test('CORS: origem permitida recebe cabeçalhos; origem estranha é bloqueada; preflight 204', async () => {
  const ok = await req(main.port, 'GET', '/api/health', { headers: { Origin: ORIGIN_OK } });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['access-control-allow-origin'], ORIGIN_OK);
  assert.equal(ok.headers['access-control-allow-credentials'], 'true');
  const bad = await req(main.port, 'GET', '/api/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers['access-control-allow-origin'], undefined);
  const pre = await req(main.port, 'OPTIONS', '/api/state', { headers: { Origin: ORIGIN_OK, 'Access-Control-Request-Method': 'PUT' } });
  assert.equal(pre.status, 204);
  assert.match(pre.headers['access-control-allow-headers'], /Authorization/);
});

test('JSON inválido retorna 400 (não 500) e erros 500 não vazam detalhes', async () => {
  const r = await req(main.port, 'POST', '/api/auth/login', { body: '{quebrado' });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'JSON inválido.');
});

test('SQL injection no login não autentica nem derruba o servidor', async () => {
  for (const email of ["' OR 1=1 --", "admin@x.com'; DROP TABLE users; --"]) {
    const r = await req(main.port, 'POST', '/api/auth/login', { body: { email, password: "' OR '1'='1" } });
    assert.ok([401, 403].includes(r.status), 'status ' + r.status);
  }
  assert.equal((await req(main.port, 'GET', '/api/health')).status, 200);
});

test('autenticação Firebase: token válido autentica; inválidos são rejeitados', async () => {
  const noTok = await req(main.port, 'GET', '/api/state');
  assert.equal(noTok.status, 401);

  const good = makeToken();
  const me = await req(main.port, 'GET', '/api/auth/me', bearer(good));
  assert.equal(me.status, 200);
  assert.equal(me.json.authenticated, true);

  const cases = {
    'aud errado': makeToken({ aud: 'outro-projeto' }),
    'iss errado': makeToken({ iss: 'https://securetoken.google.com/outro' }),
    expirado: makeToken({ exp: Math.floor(Date.now() / 1000) - 60 }),
    'assinatura de outra chave': makeToken({}, { key: otherKp.privateKey }),
    'kid desconhecido': makeToken({}, { kid: 'nao-existe' }),
    'sem sub': makeToken({ sub: '' }),
    lixo: 'abc.def.ghi'
  };
  for (const [nome, tok] of Object.entries(cases)) {
    const r = await req(main.port, 'GET', '/api/state', bearer(tok));
    assert.equal(r.status, 401, nome + ' deveria ser 401, veio ' + r.status);
  }
  // alg=none forjado
  const none = b64({ alg: 'none', kid: KID }) + '.' + b64({ iss: 'https://securetoken.google.com/' + PROJECT, aud: PROJECT, sub: 'x', exp: 9999999999 }) + '.';
  assert.equal((await req(main.port, 'GET', '/api/state', bearer(none))).status, 401);
});

test('conta Firebase com e-mail NÃO verificado não assume conta existente com o mesmo e-mail', async () => {
  const email = 'vitima-' + crypto.randomUUID().slice(0, 6) + '@example.com';
  const dono = makeToken({ email, email_verified: true });
  assert.equal((await req(main.port, 'GET', '/api/state', bearer(dono))).status, 200);
  const invasor = makeToken({ email, email_verified: false });
  assert.equal((await req(main.port, 'GET', '/api/state', bearer(invasor))).status, 401);
});

test('isolamento de dados + persistência de operações financeiras entre usuários', async () => {
  const a = makeToken(), b = makeToken();
  const estadoA = {
    receitas: [{ id: 'r1', descricao: 'Salário', valor: 5000, data: '2026-11-05' }],
    despesas: [{ id: 'd1', descricao: 'Aluguel', valor: 1800, data: '2026-11-06' }],
    contas: [{ id: 'c1', nome: 'Conta A', saldo: 3200 }], cartoes: [], investimentos: [{ id: 'i1', nome: 'CDB', valor: 1000 }], goals: []
  };
  const put = await req(main.port, 'PUT', '/api/state', { ...bearer(a), body: estadoA });
  assert.equal(put.status, 200, JSON.stringify(put.json));
  const getA = await req(main.port, 'GET', '/api/state', bearer(a));
  assert.equal(getA.status, 200);
  assert.equal(JSON.stringify(getA.json).includes('Aluguel'), true);
  const getB = await req(main.port, 'GET', '/api/state', bearer(b));
  assert.equal(getB.status, 200);
  assert.equal(JSON.stringify(getB.json).includes('Aluguel'), false, 'B não pode ver dados de A');
  assert.equal(JSON.stringify(getB.json).includes('Salário'), false);
});

test('autorização: usuário comum não acessa rotas de admin', async () => {
  const t = makeToken();
  assert.equal((await req(main.port, 'GET', '/api/admin/users', bearer(t))).status, 403);
  assert.equal((await req(main.port, 'POST', '/api/admin/admins', { ...bearer(t), body: { email: 'x@y.com' } })).status, 403);
});

test('rate limit usa o IP da direita (anti-spoof de X-Forwarded-For)', async () => {
  const b = await startBackend({ DB_PATH: path.join(tmp, 'rl.sqlite'), WAF_AUTH_RATE_MAX: '5' });
  try {
    let limited = 0;
    for (let i = 0; i < 12; i++) {
      // o atacante troca o 1º valor a cada tentativa; o IP "real" (penúltimo) é sempre o mesmo
      const r = await req(b.port, 'POST', '/api/auth/login', { headers: { 'X-Forwarded-For': `1.1.1.${i}, 203.0.113.9, 10.0.0.1` }, body: { email: 'a@b.com', password: 'x' } });
      if (r.status === 429) limited++;
    }
    assert.ok(limited >= 5, 'esperava 429 após o limite; bloqueios=' + limited);
  } finally { await stop(b); }
});

test('persistência real: dados sobrevivem a reinício; SIGTERM encerra com código 0', async () => {
  const dbFile = path.join(tmp, 'restart.sqlite');
  const t = makeToken({ sub: 'uid-restart', email: 'restart@example.com' });
  let b = await startBackend({ DB_PATH: dbFile });
  const put = await req(b.port, 'PUT', '/api/state', { ...bearer(t), body: { receitas: [{ id: 'r9', descricao: 'Freela persistente', valor: 777 }] } });
  assert.equal(put.status, 200);
  const ex = await stop(b);
  assert.equal(ex.code, 0, 'encerramento limpo esperado; log: ' + b.log());
  b = await startBackend({ DB_PATH: dbFile });
  try {
    const g = await req(b.port, 'GET', '/api/state', bearer(t));
    assert.equal(g.status, 200);
    assert.ok(JSON.stringify(g.json).includes('Freela persistente'));
  } finally { await stop(b); }
});

test('backup: gera cópia íntegra e restaurável com os dados', async () => {
  const dbFile = path.join(tmp, 'restart.sqlite');
  const dir = path.join(tmp, 'bk');
  const r = spawnSync(process.execPath, ['scripts/backup-sqlite.js'], { cwd: ROOT, env: { PATH: process.env.PATH, DB_PATH: dbFile, BACKUP_DIR: dir } });
  assert.equal(r.status, 0, String(r.stderr));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sqlite'));
  assert.equal(files.length, 1);
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(dir, files[0]), { readOnly: true });
  const row = db.prepare("SELECT state_json FROM user_states WHERE state_json LIKE '%Freela persistente%'").get();
  db.close();
  assert.ok(row, 'dados do usuário presentes no backup');
});

test('PDFs: todos os guias são servidos com application/pdf e conteúdo %PDF', async () => {
  const dir = path.join(ROOT, 'conteudos', 'educacao-financeira');
  const pdfs = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));
  assert.equal(pdfs.length, 12);
  for (const f of pdfs) {
    const r = await req(main.port, 'GET', '/conteudos/educacao-financeira/' + f);
    assert.equal(r.status, 200, f);
    assert.match(r.headers['content-type'], /application\/pdf/);
    assert.equal(r.raw.subarray(0, 5).toString(), '%PDF-', f);
  }
});

test('arquivos sensíveis não são servidos (server.js, banco, .env)', async () => {
  for (const p of ['/server.js', '/package.json', '/prisma.sqlite', '/.env', '/main.sqlite']) {
    const r = await req(main.port, 'GET', p);
    assert.ok([400, 403, 404].includes(r.status), p + ' => ' + r.status);
  }
});

test('proxy da Vercel (api/_proxy.js): encaminha ao backend real, 503 sem backend, 502 se inacessível', async () => {
  const proxy = require('../api/_proxy.js');
  const call = async (url, method = 'GET', headers = {}, body) => {
    const out = { headers: {} };
    const res = {
      statusCode: 0, setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
      end(b) { out.body = b ? b.toString() : ''; out.done(); }
    };
    await new Promise((resolve) => { out.done = resolve; proxy({ url, method, headers: { host: 'prisma-test.vercel.app', ...headers }, body }, res); });
    out.status = res.statusCode; return out;
  };
  process.env.PRISMA_BACKEND_URL = 'http://127.0.0.1:' + main.port;
  const h = await call('/api/health');
  assert.equal(h.status, 200);
  assert.equal(JSON.parse(h.body).databaseOk, true);
  // POST via proxy com Origin da Vercel (allowlist) chega ao backend; JSON inválido → 400 do backend (não 403 de origem)
  const p = await call('/api/auth/login', 'POST', { origin: ORIGIN_OK, 'content-type': 'application/json' }, '{x');
  assert.equal(p.status, 400);
  // token Firebase atravessa o proxy
  const me = await call('/api/auth/me', 'GET', { authorization: 'Bearer ' + makeToken() });
  assert.equal(JSON.parse(me.body).authenticated, true);
  process.env.PRISMA_BACKEND_URL = 'http://127.0.0.1:1';
  assert.equal((await call('/api/health')).status, 502);
  delete process.env.PRISMA_BACKEND_URL;
  assert.equal((await call('/api/health')).status, 503);
});

test('build: gera dist completo, injeta config e falha sem variáveis Firebase', () => {
  const out = path.join(tmp, 'dist');
  const env = { PATH: process.env.PATH, PRISMA_BUILD_DIR: out, FIREBASE_API_KEY: 'k-test', FIREBASE_MESSAGING_SENDER_ID: '123', FIREBASE_APP_ID: '1:123:web:abc', PRISMA_API_URL: 'https://api.exemplo.com', VERCEL: '1', VERCEL_ENV: 'production' };
  const r = spawnSync(process.execPath, ['scripts/build-netlify.js'], { cwd: ROOT, env });
  assert.equal(r.status, 0, String(r.stderr));
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'js/script.js', 'js/prisma-config.js', 'css/style.css', 'telas/dashboard.html', 'conteudos/educacao-financeira/01-orcamento-inteligente.pdf']) {
    assert.ok(fs.existsSync(path.join(out, f)), 'faltando em dist: ' + f);
  }
  assert.match(fs.readFileSync(path.join(out, 'js/firebase-config.js'), 'utf8'), /"apiKey":"k-test"/);
  assert.match(fs.readFileSync(path.join(out, 'js/prisma-config.js'), 'utf8'), /https:\/\/api\.exemplo\.com/);
  assert.equal(fs.existsSync(path.join(out, 'build-env-debug.json')), false, 'debug não deve ir a produção');
  assert.ok(!fs.existsSync(path.join(out, 'server.js')) && !fs.existsSync(path.join(out, '.env')));
  const bad = spawnSync(process.execPath, ['scripts/build-netlify.js'], { cwd: ROOT, env: { PATH: process.env.PATH, PRISMA_BUILD_DIR: path.join(tmp, 'd2') } });
  assert.notEqual(bad.status, 0);
  const badUrl = spawnSync(process.execPath, ['scripts/build-netlify.js'], { cwd: ROOT, env: { ...env, PRISMA_API_URL: 'http://inseguro.com' } });
  assert.notEqual(badUrl.status, 0);
});

test('configuração: vercel.json/render.yaml coerentes e sem segredos versionados', () => {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(v.outputDirectory, 'dist');
  const all = JSON.stringify(v.headers);
  assert.ok(all.includes('SAMEORIGIN'), 'X-Frame-Options deve ser SAMEORIGIN (viewer de PDF usa iframe)');
  assert.ok(!all.includes('"DENY"'));
  const render = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
  assert.match(render, /mountPath: \/var\/data/);
  assert.match(render, /DB_PATH[\s\S]*\/var\/data\/prisma\.sqlite/);
  assert.match(render, /healthCheckPath: \/api\/health/);
  assert.match(render, /value: 22\s/);
  const envEx = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(!/AIza[0-9A-Za-z_-]{30,}/.test(envEx), '.env.example não pode ter chave real');
  assert.ok(!/localhost/.test(fs.readFileSync(path.join(ROOT, 'js/prisma-config.js'), 'utf8')));
});

test('frontend: apiFetch usa config central, timeout e token Firebase; sem localhost fixo em produção', () => {
  const s = fs.readFileSync(path.join(ROOT, 'js/script.js'), 'utf8');
  assert.match(s, /window\.PRISMA_API_URL/);
  assert.match(s, /AbortController/);
  assert.match(s, /Authorization:'Bearer '/);
  const fc = fs.readFileSync(path.join(ROOT, 'js/firebase-client.js'), 'utf8');
  assert.match(fc, /getIdToken/);
});
