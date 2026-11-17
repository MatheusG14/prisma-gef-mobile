'use strict';

/**
 * Build estático do Prisma (Netlify / Vercel / local).
 * Injeta window.PRISMA_FIREBASE_CONFIG a partir das variáveis de ambiente.
 *
 * Obrigatórias: FIREBASE_API_KEY, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
 * Recomendadas: FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.PRISMA_BUILD_DIR || path.join(root, 'dist'));

function mask(value) {
  const s = String(value || '');
  if (!s) return '(vazia)';
  if (s.length <= 8) return s.slice(0, 2) + '***';
  return s.slice(0, 6) + '…' + s.slice(-4) + ' (len=' + s.length + ')';
}

function readEnv(name, fallback = '') {
  const v = process.env[name];
  if (v == null || String(v).trim() === '') return fallback;
  return String(v).trim();
}

// Diagnóstico — NÃO imprime segredos completos
const envReport = {
  FIREBASE_API_KEY: readEnv('FIREBASE_API_KEY'),
  FIREBASE_AUTH_DOMAIN: readEnv('FIREBASE_AUTH_DOMAIN'),
  FIREBASE_PROJECT_ID: readEnv('FIREBASE_PROJECT_ID'),
  FIREBASE_STORAGE_BUCKET: readEnv('FIREBASE_STORAGE_BUCKET'),
  FIREBASE_MESSAGING_SENDER_ID: readEnv('FIREBASE_MESSAGING_SENDER_ID'),
  FIREBASE_APP_ID: readEnv('FIREBASE_APP_ID'),
  VERCEL: process.env.VERCEL || '',
  VERCEL_ENV: process.env.VERCEL_ENV || '',
  CONTEXT: process.env.CONTEXT || '', // Netlify
  NODE_ENV: process.env.NODE_ENV || ''
};

console.log('=== Prisma build · diagnóstico de ambiente ===');
console.log('Host CI:', envReport.VERCEL ? 'Vercel' : envReport.CONTEXT ? 'Netlify' : 'local');
if (envReport.VERCEL) console.log('VERCEL_ENV:', envReport.VERCEL_ENV || '(não definido)');
if (envReport.CONTEXT) console.log('Netlify CONTEXT:', envReport.CONTEXT);
console.log('Variáveis Firebase:');
[
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID'
].forEach((name) => {
  const raw = process.env[name];
  const present = raw != null && String(raw).trim() !== '';
  console.log(
    `  ${present ? '✓' : '✗'} ${name}=${present ? mask(raw) : '(AUSENTE)'}`
  );
});

const firebaseConfig = {
  apiKey: readEnv('FIREBASE_API_KEY'),
  authDomain: readEnv('FIREBASE_AUTH_DOMAIN', 'prisma-gef.firebaseapp.com'),
  projectId: readEnv('FIREBASE_PROJECT_ID', 'prisma-gef'),
  storageBucket: readEnv('FIREBASE_STORAGE_BUCKET', 'prisma-gef.firebasestorage.app'),
  messagingSenderId: readEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('FIREBASE_APP_ID')
};

const missing = ['apiKey', 'messagingSenderId', 'appId'].filter((key) => !firebaseConfig[key]);

if (missing.length) {
  console.error('');
  console.error('Build INTERROMPIDO — variáveis Firebase obrigatórias ausentes.');
  console.error('Faltando no process.env (nomes do config):', missing.join(', '));
  console.error('');
  console.error('Na Vercel: Settings → Environment Variables');
  console.error('  • Nomes EXATOS: FIREBASE_API_KEY, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID');
  console.error('  • Ambientes: Production E Preview (e Development se usar vercel dev)');
  console.error('  • Disponíveis para: Build (obrigatório para site estático)');
  console.error('  • Depois: Redeploy SEM cache');
  console.error('');
  throw new Error(
    `Build do Prisma interrompido. Configure as variáveis Firebase: ${missing.join(', ')}.`
  );
}

fs.mkdirSync(output, { recursive: true });
for (const entry of [
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'sw.js',
  'capacitor.config.json',
  'assets',
  'css',
  'js',
  'telas',
  'conteudos'
]) {
  const source = path.join(root, entry);
  const destination = path.join(output, entry);
  if (fs.existsSync(source)) {
    fs.cpSync(source, destination, { recursive: true });
  }
}

// URL pública da API (opcional). Vazio = mesmo domínio; a Vercel encaminha /api/* ao Render.
const apiUrl = readEnv('PRISMA_API_URL').replace(/\/$/, '');
if (apiUrl && !/^https:\/\//i.test(apiUrl) && !/^http:\/\/localhost(:\d+)?$/i.test(apiUrl)) {
  throw new Error('PRISMA_API_URL deve usar HTTPS (ou http://localhost em desenvolvimento).');
}
fs.writeFileSync(
  path.join(output, 'js', 'prisma-config.js'),
  '/* gerado no build — não editar */\n' + `window.PRISMA_API_URL = ${JSON.stringify(apiUrl)};\n`,
  'utf8'
);

const configPath = path.join(output, 'js', 'firebase-config.js');
const configBody =
  '/* gerado no build — não editar */\n' +
  `window.PRISMA_FIREBASE_CONFIG = Object.freeze(${JSON.stringify(firebaseConfig)});\n`;
fs.writeFileSync(configPath, configBody, { encoding: 'utf8', mode: 0o644 });

// Manifesto seguro de debug (sem segredos) para inspecionar no browser após deploy
const debugPath = path.join(output, 'build-env-debug.json');
const isProductionBuild = envReport.VERCEL_ENV === 'production' || envReport.NODE_ENV === 'production';
if (!isProductionBuild) fs.writeFileSync(
  debugPath,
  JSON.stringify(
    {
      ok: true,
      builtAt: new Date().toISOString(),
      host: envReport.VERCEL ? 'vercel' : envReport.CONTEXT ? 'netlify' : 'local',
      vercelEnv: envReport.VERCEL_ENV || null,
      firebase: {
        apiKey: Boolean(firebaseConfig.apiKey),
        apiKeyMasked: mask(firebaseConfig.apiKey),
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: Boolean(firebaseConfig.messagingSenderId),
        messagingSenderIdMasked: mask(firebaseConfig.messagingSenderId),
        appId: Boolean(firebaseConfig.appId),
        appIdMasked: mask(firebaseConfig.appId)
      }
    },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log('');
console.log(`Build estático do Prisma criado em ${output}.`);
console.log('Config escrita em js/firebase-config.js');
console.log('Debug público (sem segredos): build-env-debug.json');
console.log('  apiKey:', mask(firebaseConfig.apiKey));
console.log('  projectId:', firebaseConfig.projectId);
console.log('  authDomain:', firebaseConfig.authDomain);
