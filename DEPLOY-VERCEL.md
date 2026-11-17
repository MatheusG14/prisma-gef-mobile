# Publicação do Prisma GEF — Vercel + backend persistente

## Arquitetura aplicada
- A Vercel publica o frontend HTML/CSS/JS estático a partir de `dist`.
- As rotas `/api/*` são encaminhadas pela função serverless `api/[...path].js`.
- O backend existente (`server.js`) continua responsável por autenticação, regras e endpoints. Ele roda como serviço Node no Render, com SQLite em disco persistente (`/var/data/prisma.sqlite`).
- O navegador acessa `/api/*` no mesmo domínio Vercel; o proxy encaminha cookies e respostas para o backend.

> O SQLite não é armazenado no filesystem efêmero das funções Vercel. Para manter SQLite e persistência, o backend precisa de um serviço com disco persistente. O frontend e o proxy continuam na Vercel.

## 1. Publicar o backend no Render
1. Envie esta versão do projeto ao GitHub.
2. No Render, crie um serviço usando **Blueprint** e selecione o repositório (ele detectará `render.yaml`).
3. Confirme o plano com disco persistente (o disco não está disponível no plano gratuito).
4. Aguarde o serviço ficar `Live` e copie sua URL HTTPS, por exemplo `https://prisma-gef-api.onrender.com`.
5. No painel do serviço, configure também as variáveis de e-mail/administrador que realmente utilizar, como `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_SECURE`. Não coloque segredos no GitHub.

## 2. Configurar a Vercel
Em **Project → Settings → Environment Variables**, configure:
- `PRISMA_BACKEND_URL` = URL HTTPS do serviço Render, sem `/` no final.
- `FIREBASE_API_KEY`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_AUTH_DOMAIN` (recomendado)
- `FIREBASE_PROJECT_ID` (recomendado)
- `FIREBASE_STORAGE_BUCKET` (recomendado)

Aplique as variáveis a Production e Preview conforme necessário e faça **Redeploy**.

## 3. Configuração de build da Vercel
- Framework Preset: Other
- Build Command: `npm run build:netlify`
- Output Directory: `dist`
- Install Command: `npm install`
- Root Directory: raiz do repositório (onde está este `package.json`).

## 4. Verificação
- `https://SEU-DOMINIO/api/health` deve retornar o health check do backend Render.
- Teste cadastro, login, logout, recuperação de senha, estado financeiro, LGPD, insights, PDFs e painel administrativo.
- Faça um cadastro de teste, reinicie o serviço Render e confirme que o usuário continua salvo.

## Observações importantes
- Este ajuste mantém o backend SQLite existente e não migra os dados para Firestore. O banco SQLite persiste no disco do Render.
- Se já existem usuários/dados em um arquivo `prisma.sqlite` local, eles não são enviados automaticamente ao Render. Faça uma migração/backup controlado antes de usar em produção.
- O plano do Render com disco persistente tem custo. Não selecione armazenamento efêmero para produção.
- O `api/debug-env` permanece como diagnóstico apenas das variáveis Firebase do runtime Vercel; ele não testa a conexão do backend.
