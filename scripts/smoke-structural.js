'use strict';
/**
 * Smoke estrutural – não exige Firebase nem browser.
 * Exit 0 = ok; 1 = falha.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const errors = [];
const ok = [];

function mustExist(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) errors.push('Ausente: ' + rel);
  else ok.push(rel);
}

function fileIncludes(rel, snippet) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    errors.push('Ausente: ' + rel);
    return;
  }
  const text = fs.readFileSync(p, 'utf8');
  if (!text.includes(snippet)) errors.push(`${rel} não contém: ${snippet}`);
  else ok.push(`${rel} ∋ ${snippet.slice(0, 40)}`);
}

mustExist('index.html');
mustExist('css/responsive.css');
mustExist('js/firebase-client.js');
mustExist('js/prisma-pwa.js');
mustExist('js/prisma-storage.js');
mustExist('manifest.webmanifest');
mustExist('sw.js');
mustExist('offline.html');
mustExist('capacitor.config.json');
mustExist('netlify.toml');
mustExist('netlify/functions/health.js');
mustExist('firestore.rules');
mustExist('playwright.config.js');
mustExist('tests/e2e/smoke.spec.js');
mustExist('.github/workflows/ci.yml');
mustExist('assets/images/pwa/icon-192.png');
mustExist('assets/images/pwa/icon-512.png');
mustExist('assets/images/pwa/icon-maskable-192.png');
mustExist('assets/images/pwa/icon-maskable-512.png');
mustExist('api/health.js');
mustExist('vercel.json');

fileIncludes('index.html', 'viewport-fit=cover');
fileIncludes('index.html', 'responsive.css');
fileIncludes('index.html', 'manifest.webmanifest');
fileIncludes('index.html', 'prisma-pwa.js');
fileIncludes('index.html', 'id="sidebarCloseBtn"');
fileIncludes('index.html', 'id="sidebarOverlay"');
fileIncludes('js/firebase-client.js', 'inMemoryPersistence');
fileIncludes('js/firebase-client.js', 'persistentLocalCache');
fileIncludes('sw.js', 'SHELL_CACHE');
fileIncludes('manifest.webmanifest', 'standalone');
fileIncludes('netlify.toml', 'netlify/functions');
fileIncludes('package.json', 'build:netlify');

const sections = [
  'dashboard', 'centro-financeiro', 'receitas', 'despesas', 'contas',
  'cartoes', 'metas', 'investimentos', 'prisma-ai', 'educacao-financeira',
  'relatorios', 'dados', 'configuracoes'
];
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sidebarNav = indexHtml.match(/<nav\b[^>]*class="sidebar-nav"[^>]*>([\s\S]*?)<\/nav>/i);
if (!sidebarNav) {
  errors.push('index.html não contém a navegação lateral');
}
if (/<nav\b[^>]*(?:bottom-nav|bottomNav)/i.test(indexHtml)) {
  errors.push('index.html ainda contém uma barra inferior de navegação');
}
for (const s of sections) {
  if (!sidebarNav || !sidebarNav[1].includes(`data-section="${s}"`)) {
    errors.push(`sidebar sem data-section=${s}`);
  }
}

console.log('=== Smoke estrutural Prisma GEF ===');
console.log('OK:', ok.length);
if (errors.length) {
  console.error('FALHAS:');
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
}
console.log('Todas as checagens estruturais passaram.');
process.exit(0);
