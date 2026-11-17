# Checklist de aceite – Prisma GEF (mobile / PWA / Firebase)

Marque em cada ambiente. **Não pule o console** (F12 / inspecionar).

## Ambientes

- [ ] Chrome Android (retrato)
- [ ] Chrome Android (paisagem)
- [ ] Safari iOS (retrato)
- [ ] Safari iOS (paisagem)
- [ ] Chrome desktop ≥ 1280px
- [ ] Tablet 768–1024 (retrato e paisagem)

## Global

- [ ] Sem scroll horizontal em nenhuma tela
- [ ] Viewport com notch/safe-area ok (não corta conteúdo sob status bar)
- [ ] Bottom-nav visível ≤768px; oculto no desktop
- [ ] Hamburger + sidebar funcionam no mobile
- [ ] Alvos de toque confortáveis (~44px)
- [ ] Teclado iOS não faz zoom indevido nos inputs (font ≥16px)
- [ ] Console sem erros vermelhos após login

## PWA

- [ ] Manifest válido (Application → Manifest)
- [ ] Service Worker registrado (Application → SW)
- [ ] “Adicionar à tela inicial” / install prompt (quando o browser oferecer)
- [ ] Abrir como standalone
- [ ] Offline: shell ou `offline.html` (sem dados sensíveis em cache do SW)

## Auth e dados (Firebase configurado)

- [ ] Cadastro
- [ ] Login
- [ ] Recuperação de senha (e-mail chega se SMTP/Firebase reset ok)
- [ ] Logout
- [ ] Dados gravados (receita/despesa) aparecem após F5
- [ ] Mesma conta em 2º dispositivo/navegador vê os dados
- [ ] Offline → online: alterações sincronizam (ou conflito tratado com aviso)
- [ ] LGPD / consentimento na primeira vez

## Por módulo (após login)

Para cada um: **abre · navega · grava · lê · sem erro console · sem scroll H**

| Módulo | Abre | Navega | Grava | Lê | Console | Scroll H |
|--------|------|--------|-------|-----|---------|----------|
| Dashboard | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Centro Financeiro | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Receitas | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Despesas | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Contas | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Cartões | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Metas | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Investimentos | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Carteira ativos | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Prisma AI | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Educação Financeira | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Relatórios | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Perfil | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Configurações | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Notificações (navbar) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

## Performance / Lighthouse (mobile)

- [ ] Performance ≥ 90 (meta orientativa)
- [ ] Accessibility ≥ 90
- [ ] Best Practices ≥ 90
- [ ] PWA ≥ 90

```bash
npm run build:netlify
npx serve dist -l 4173
npm run lighthouse:mobile
```

## Capacitor (opcional)

- [ ] `npx cap sync` sem erro
- [ ] Abre no Android Studio
- [ ] App sobe no emulador/device

## Comando estrutural local (sem Firebase)

```bash
node scripts/smoke-structural.js
```
