# DEPLOY-PRODUCAO — Prisma GEF

GitHub → **Vercel** (frontend + proxy `/api/*`) → **Render** (backend Node + SQLite em disco persistente).

## 1. Arquitetura e fontes de verdade

| Dado / função | Onde vive |
|---|---|
| Login, cadastro, recuperação de senha, Google | **Firebase Authentication** (já implementado no front) |
| Estado financeiro (receitas, despesas, contas, cartões, investimentos, metas, perfil) e consentimento LGPD | **Firestore** (`users/{uid}/appData/state`, regras em `firestore.rules`) |
| Histórico de envio de PDFs por e-mail, auditoria, insights, administração, limites | **SQLite** no Render |

O backend agora aceita `Authorization: Bearer <ID token do Firebase>`: valida assinatura RS256 contra as chaves públicas do Google, `aud`, `iss` e `exp`, e cria/associa um usuário SQLite pelo `uid`. Antes, o front autenticava só no Firebase e **qualquer chamada ao backend (ex.: enviar PDF por e-mail) retornava 401**, porque nunca existia sessão SQLite.
Contas existentes só são vinculadas por e-mail se o Firebase marcar o e-mail como verificado.
Os endpoints legados `/api/auth/register|login` e `/api/state` continuam no servidor (nada foi removido), mas o front atual não os usa — não há duplicação do estado financeiro.

## 2. Arquivos alterados / criados

Alterados: `server.js`, `js/script.js` (apenas `apiFetch`), `js/firebase-client.js` (+`getIdToken`), `index.html` (+`prisma-config.js`), `sw.js`, `vercel.json`, `render.yaml`, `package.json`, `Dockerfile`, `.env.example`, `.gitignore`, `scripts/build-netlify.js`, `api/debug-env.js`.
Criados: `js/prisma-config.js`, `api/status.js`, `scripts/backup-sqlite.js`, `tests/prisma-production.test.js`, `DEPLOY-PRODUCAO.md`.

Principais correções: 
- `X-Frame-Options: DENY` na Vercel bloqueava o leitor de PDF (usa `<iframe>`) → `SAMEORIGIN`.
- Backend rejeitava (403) qualquer POST vindo do proxy (Origin = domínio Vercel) → allowlist `ALLOWED_ORIGINS`.
- Rate limit confiava no 1º valor de `X-Forwarded-For` (forjável) → IP lido da direita (`TRUST_PROXY_HOPS`).
- `render.yaml` fixava Node 22.5.0, que exige flag para `node:sqlite` → Node 22 (≥ 22.13).
- `/api/health` expunha o caminho do banco → removido; agora testa o banco (503 se falhar).
- `/api/debug-env` era público → exige `DEBUG_ENV_TOKEN` (404 sem ele); `build-env-debug.json` não vai mais para produção.
- Reset de senha: mensagem idêntica exista ou não o e-mail; link nunca montado pelo cabeçalho Host em produção (usa `APP_BASE_URL`).
- JSON inválido virava 500 → 400; 500 em produção não vaza mensagem interna.
- Novos: migrações versionadas (`schema_migrations`), `busy_timeout`, recusa de `DB_PATH` ausente/temporário em produção, SIGTERM com checkpoint do WAL, backup agendado, timeout e token no `apiFetch`, URL da API centralizada (`PRISMA_API_URL`).

## 3. Serviços a criar
1. Repositório GitHub (sem `.env`; `*.sqlite` já está no `.gitignore`).
2. **Render**: Web Service via Blueprint (`render.yaml`) — plano pago (disco persistente).
3. **Vercel**: projeto apontando ao repositório (build `npm run build`, saída `dist`).
4. Projeto Firebase `prisma-gef` (Auth e-mail/senha + Google, Firestore). Publique `firestore.rules`.

## 4. Variáveis

**Vercel** (Production e Preview): `FIREBASE_API_KEY`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` (obrigatórias no build), `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, **`PRISMA_BACKEND_URL`** (URL HTTPS do Render, sem `/`). Opcionais: `PRISMA_API_URL`, `DEBUG_ENV_TOKEN`.

**Render**: já no `render.yaml` — `NODE_ENV`, `NODE_VERSION=22`, `DB_PATH=/var/data/prisma.sqlite`, `BACKUP_*`, `TRUST_PROXY_HOPS=2`, `FIREBASE_PROJECT_ID`. Você preenche (marcadas `sync: false`): **`ALLOWED_ORIGINS`** (domínio(s) da Vercel, separados por vírgula), **`APP_BASE_URL`**, e se for usar: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`.
> Se o domínio da Vercel mudar (ou houver domínio próprio), atualize `ALLOWED_ORIGINS`, senão as chamadas retornam 403 "Origem não permitida".

## 5. Disco persistente (Render)
O `render.yaml` declara o disco `prisma-gef-data` montado em `/var/data` (1 GB; aumente se necessário). O banco fica em `/var/data/prisma.sqlite` e os backups em `/var/data/backups`. O servidor **não inicia** em produção sem `DB_PATH` ou com caminho em `/tmp`. Discos do Render permitem uma única instância: não escale horizontalmente com SQLite.

## 6. Primeiro deploy
1. Suba o código ao GitHub.
2. Render → New → Blueprint → selecione o repositório → preencha as variáveis `sync: false` → aguarde `Live`. Confira `https://<render>/api/health` → `ok:true, databaseOk:true`.
3. Vercel → Import → defina as variáveis (inclua `PRISMA_BACKEND_URL`) → Deploy.
4. Adicione o domínio Vercel em `ALLOWED_ORIGINS` no Render (e `APP_BASE_URL`) → redeploy do Render.
5. Firebase Console → Authentication → Domínios autorizados: adicione o domínio Vercel.
6. Verifique `https://<vercel>/api/status` → `ok:true`.

## 7. Atualizações
`git push` na branch principal dispara Vercel e Render (autoDeploy). Migrações do SQLite rodam sozinhas na inicialização (idempotentes, transacionais, não destrutivas). Faça um backup manual antes de mudanças de schema.

## 8. Saúde e logs
- Vercel: `/api/status` (front + sonda do backend). Render: `/api/health` (também usado como health check).
- Logs: painel do Render (erros aparecem como `[ERRO 500] MÉTODO /rota` + stack) e Functions logs da Vercel.

## 9. Backups
- Automático: a cada 24 h em `/var/data/backups`, mantendo 14 (`BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP`). Usa `VACUUM INTO` (consistente com o servidor ligado).
- Manual (Render Shell): `npm run backup`. O script valida `PRAGMA integrity_check`.
- **Restaurar**: pare o serviço, copie o arquivo `prisma-AAAA-...sqlite` para `/var/data/prisma.sqlite`, remova `prisma.sqlite-wal` e `-shm` antigos, inicie.
- Backup no mesmo disco não protege contra perda do disco: baixe cópias periodicamente (ou use os snapshots de disco do Render).

## 10. Diagnóstico de erro 500
1. Veja o log do Render no horário (`[ERRO 500]`).
2. `/api/health` com `databaseOk:false` → disco/permissão/arquivo corrompido → restaurar backup.
3. 502/503 em `/api/*` na Vercel → `PRISMA_BACKEND_URL` ausente/errado ou Render dormindo/reiniciando (`/api/status`).
4. 403 "Origem não permitida" → faltou o domínio em `ALLOWED_ORIGINS`.
5. 401 em chamadas do front → token Firebase expirado/projeto diferente (`FIREBASE_PROJECT_ID` do Render deve ser igual ao do front).
6. 429 → limite de requisições (`WAF_*_RATE_MAX`); confira `TRUST_PROXY_HOPS`.

## 11. Limites e alternativa de banco
SQLite atende bem a um único serviço com poucos milhares de usuários (WAL + `busy_timeout`). Se houver necessidade de várias instâncias, alta concorrência de escrita ou failover, a alternativa recomendada é **PostgreSQL gerenciado (Render/Neon)** com migração planejada. **Nenhuma migração foi feita nem é necessária agora.**

## 12. Resultado dos testes (executados neste ambiente)

Comando: `npm test` (35 testes: 17 existentes + 18 novos) e `npm run test:audit`. Resultado: **35/35 passaram**. Os testes novos sobem o `server.js` real como processo filho (produção, SQLite em arquivo). Única simulação: servidor JWKS local com chave RSA gerada no teste (não é o Firebase real). Um teste de mutação confirmou que o teste de rate limit falha com o código antigo.

| Funcionalidade | Situação | Teste executado | Resultado | Pendências |
|---|---|---|---|---|
| Build estático (dist, config Firebase/API, PDFs) | Pronto | build com env, falha sem env, rejeita API http | APROVADO | Build real na Vercel não executado |
| Backend: inicialização, DB_PATH, migrações | Pronto | processo filho em modo produção | APROVADO | — |
| Health check | Pronto | `/api/health` | APROVADO | — |
| CORS / origem | Pronto | permitida, bloqueada, preflight | APROVADO | — |
| Auth via ID token Firebase (backend) | Pronto | válido, aud/iss/exp/assinatura/kid/alg=none/e-mail não verificado | APROVADO (JWKS simulado) | Não validado contra Firebase real |
| Isolamento de dados entre usuários | Pronto | A grava, B não lê | APROVADO | — |
| Autorização admin | Pronto | usuário comum → 403 | APROVADO | — |
| Persistência SQLite + reinício + SIGTERM | Pronto | gravar, reiniciar, ler | APROVADO | Disco persistente do Render não testado |
| Backup e restauração | Pronto | backup + integrity_check + leitura | APROVADO | — |
| Rate limit anti-spoof, SQL injection, arquivos sensíveis | Pronto | testes dedicados | APROVADO | — |
| PDFs (12 guias estáticos) | Pronto | content-type e `%PDF-` | APROVADO | Visualização no iframe não testada em navegador |
| Proxy Vercel → backend | Pronto | chamada real ao backend, 503, 502, Bearer, Origin | APROVADO | Função na Vercel real não testada |
| Fluxos existentes (registro/login/estado SQLite legados) | Preservados | 17 testes existentes | APROVADO | — |
| Cadastro, login, Google, recuperação de senha (Firebase real) | Não alterado | — | NÃO TESTADO | Exige projeto Firebase e navegador |
| Firestore + `firestore.rules` | Não alterado | — | NÃO TESTADO | Exige emulador/projeto |
| Receitas, despesas, contas, cartões, investimentos, patrimônio, fluxo de caixa, Prisma Score, Centro Financeiro, gráficos, relatórios, notificações, Monitoramento, configurações, exportação | Não alterados | só auditorias estáticas (HTML/CSS/IDs) | NÃO TESTADO | Exige navegador (sem Chromium/rede aqui); rodar `npm run test:e2e` |
| Educação Financeira (envio de PDF por e-mail) | Corrigido (token) | só caminho de auth | NÃO TESTADO | Exige SMTP real |
| Prisma IA (backend) | Não alterado | — | NÃO TESTADO | O front não sincroniza o plano com SQLite (só via Firestore) |
| Responsividade (desktop/tablet/Android/iOS) | Não alterada | — | NÃO TESTADO | Exige navegador/dispositivos |
| CSP da Vercel | Em modo **Report-Only** | — | NÃO TESTADO | Verifique o console no navegador e depois troque para `Content-Security-Policy` |
| Deploy real GitHub→Vercel→Render | — | — | NÃO TESTADO | Depende das suas contas e variáveis |
