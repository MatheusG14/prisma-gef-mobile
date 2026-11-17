/**
 * Prisma PWA — registro do Service Worker + prompt de instalação
 * Não altera fluxos existentes; apenas adiciona capacidade PWA.
 */
(function () {
  'use strict';

  const DISMISS_KEY = 'prisma_pwa_install_dismissed_v1';

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js', { scope: './' })
        .then((reg) => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão disponível — opcional: notificar usuário
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[Prisma PWA] Falha ao registrar Service Worker:', err);
        });
    });
  }

  function createInstallBanner() {
    if (document.getElementById('pwaInstallBanner')) return document.getElementById('pwaInstallBanner');
    const banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.className = 'pwa-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Instalar aplicativo Prisma');
    banner.innerHTML =
      '<div class="pwa-install-text">' +
      '<strong>Instalar o Prisma</strong>' +
      '<span>Adicione à tela inicial para acesso rápido e uso offline do app.</span>' +
      '</div>' +
      '<div class="pwa-install-actions">' +
      '<button type="button" class="pwa-install-dismiss" id="pwaInstallDismiss">Agora não</button>' +
      '<button type="button" class="pwa-install-btn" id="pwaInstallBtn">Instalar</button>' +
      '</div>';
    document.body.appendChild(banner);
    return banner;
  }

  function setupInstallPrompt() {
    let deferredPrompt = null;
    const dismissed = (() => {
      try {
        return localStorage.getItem(DISMISS_KEY) === '1';
      } catch (_) {
        return false;
      }
    })();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (dismissed) return;
      const banner = createInstallBanner();
      banner.classList.add('show');

      const btn = document.getElementById('pwaInstallBtn');
      const dismiss = document.getElementById('pwaInstallDismiss');

      if (btn) {
        btn.onclick = async () => {
          banner.classList.remove('show');
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          try {
            await deferredPrompt.userChoice;
          } catch (_) {}
          deferredPrompt = null;
        };
      }
      if (dismiss) {
        dismiss.onclick = () => {
          banner.classList.remove('show');
          try {
            localStorage.setItem(DISMISS_KEY, '1');
          } catch (_) {}
        };
      }
    });

    window.addEventListener('appinstalled', () => {
      const banner = document.getElementById('pwaInstallBanner');
      if (banner) banner.classList.remove('show');
      deferredPrompt = null;
    });
  }

  registerServiceWorker();
  setupInstallPrompt();
})();
