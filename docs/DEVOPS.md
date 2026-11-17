# DevOps – Prisma GEF

## Ambientes

| Ambiente | Branch / trigger | Host | Variáveis |
|----------|------------------|------|-----------|
| development | local | `npm start` ou static server | `.env` |
| staging | PR / branch `develop` | Netlify Deploy Preview | Site env “Deploy previews” |
| production | `main` | Netlify production | Site env production |

Configure no Netlify (Site settings → Environment variables) os valores `FIREBASE_*` por contexto.

## CI (GitHub Actions)

Arquivo: `.github/workflows/ci.yml`

1. `npm run test:audit` + `npm test`
2. `npm run build:netlify` (exige placeholders ou secrets `FIREBASE_*`)
3. Playwright smoke (mobile/tablet) – non-blocking se não instalado
4. Lighthouse mobile – artifact JSON, non-blocking

Secrets recomendados no repositório:

- `FIREBASE_API_KEY`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
- (opcional) `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`

Deploy de produção: conectar o repositório ao Netlify (build command `npm run build:netlify`, publish `dist`).  
Previews automáticos em Pull Requests via integração Netlify + GitHub.

## Netlify

- `netlify.toml`: build, headers de segurança, `/api/health` → Function
- Functions: `netlify/functions/health.js`
- **Não** usar SQLite no Netlify

## Vercel

`vercel.json` define `buildCommand` + `outputDirectory: dist`.  
O projeto **pode** publicar na Vercel como site estático, desde que as mesmas variáveis `FIREBASE_*` estejam configuradas no projeto Vercel.  
Netlify Functions **não** rodam na Vercel; use Vercel Serverless se precisar de `/api/health` lá, ou ignore o health check.

## Playwright

```bash
npm run test:e2e:install
npm run build:netlify   # com FIREBASE_* no env
npm run test:e2e
```

Viewports: iPhone 12 (390), Pixel 5 (393), iPad (768).

## Lighthouse

Meta orientativa: ≥ 90 em Performance, Accessibility, Best Practices e PWA no form-factor mobile.  
Rodar após build + `npx serve dist`.

## Sentry (opcional, plano gratuito)

1. Crie projeto em sentry.io (browser JS).
2. Defina `SENTRY_DSN` apenas se integrar o SDK (não incluso por padrão para não alterar o runtime sem necessidade).
3. Ambiente: `SENTRY_ENVIRONMENT=production|staging|development`.

Integração mínima futura: carregar o snippet Sentry no `index.html` somente quando `SENTRY_DSN` existir no build.

## Backup Firestore

1. Console Firebase → Firestore → Import/Export (requer bucket GCS).
2. Ou `gcloud firestore export gs://SEU_BUCKET/prisma-backups/$(date +%F)` com service account **fora** do frontend.
3. Export manual por usuário: a UI já persiste estado; documente para o usuário “exportar dados” se houver botão de exportação no app.
4. Reter exports por política interna (ex.: 30 dias).

## Capacitor / Android

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android --save-dev
npm run build:netlify
npx cap add android
npx cap sync
npx cap open android
```

`capacitor.config.json` aponta `webDir: dist`.
