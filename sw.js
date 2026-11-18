/**
 * Prisma Service Worker
 * Cache do app shell (HTML/CSS/JS/ícones estáticos).
 * NÃO cacheia dados de usuário, Firestore, Auth nem APIs sensíveis.
 */
const CACHE_VERSION = 'prisma-shell-v3-20261118-search-toggle-row-v1';
const SHELL_CACHE = CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './offline.html',
  './css/style.css',
  './css/prisma-premium.css',
  './css/prisma-modern.css',
  './css/prisma-redesign.css',
  './css/prisma-finance-center.css',
  './css/prisma-lgpd.css',
  './css/prisma-dashboard-premium.css',
  './css/responsive.css',
  './css/prisma-mobile.css',
  './js/prisma-storage.js',
  './js/screen-loader.js',
  './js/firebase-config.js',
  './js/prisma-config.js',
  './js/prisma-ai-engine.js',
  './assets/images/logo-mark.png',
  './assets/images/logo.png',
  './assets/images/favicon-32.png',
  './assets/images/favicon-16.png',
  './assets/images/apple-touch-icon.png',
  './assets/images/pwa/icon-192.png',
  './assets/images/pwa/icon-512.png'
];

const NEVER_CACHE = [
  /firebase/i,
  /googleapis/i,
  /firestore/i,
  /identitytoolkit/i,
  /securetoken/i,
  /\/api\//i,
  /localStorage/i
];

function shouldBypass(url) {
  const href = typeof url === 'string' ? url : url.href;
  return NEVER_CACHE.some((re) => re.test(href));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(APP_SHELL.map((path) => new Request(path, { cache: 'reload' }))).catch((err) => {
        console.warn('[Prisma SW] Alguns assets do shell não foram cacheados:', err);
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('prisma-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Não interceptar cross-origin sensível nem APIs
  if (shouldBypass(url)) return;
  if (url.origin !== self.location.origin) return;

  // Navegação: network-first com fallback offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches.match('./index.html').then((cached) => cached || caches.match('./offline.html'))
        )
    );
    return;
  }

  // Assets estáticos: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('./offline.html'));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
