# Configurar o projeto Firebase `prisma-gef`

Console: https://console.firebase.google.com/project/prisma-gef/settings/general

App Web detectado na URL (id interno): `e4c9fecb-6ded-4435-b73d-c8c77102445c`

## 1. Ativar Authentication

1. [Authentication](https://console.firebase.google.com/project/prisma-gef/authentication) → **Get started** (se pedido)
2. **Sign-in method** → **E-mail/senha** → **Ativar** → Salvar

## 2. Criar Firestore

1. [Firestore](https://console.firebase.google.com/project/prisma-gef/firestore) → Create database
2. Modo: produção (ou teste por poucos dias)
3. Região: escolha uma (ex. `southamerica-east1`)
4. Em **Rules**, publique o conteúdo do arquivo `firestore.rules` deste repositório

## 3. Copiar config do app Web

1. [Configurações do projeto](https://console.firebase.google.com/project/prisma-gef/settings/general)
2. Role até **Seus apps** → app **Web** (</>)
3. Se não houver app Web: **Add app** → Web → apelido "Prisma"
4. Copie o objeto `firebaseConfig` — exemplo de formato:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "prisma-gef.firebaseapp.com",
  projectId: "prisma-gef",
  storageBucket: "prisma-gef.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef"
};
```

## 4. Colar na Vercel

Settings → Environment Variables → para **Production** e **Preview**:

| Nome na Vercel | Campo do firebaseConfig |
|----------------|-------------------------|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |

Redeploy **sem cache**.

## 5. Domínios autorizados

Authentication → Settings → **Authorized domains**:

- `localhost`
- `SEU-PROJETO.vercel.app`
- domínio customizado (se houver)

## 6. Validar

Após deploy:

- `https://seu-site/build-env-debug.json` → `apiKey: true`
- `https://seu-site/js/firebase-config.js` → apiKey não vazia
- Login com um e-mail de teste

## Local

```bash
cp .env.example .env
# edite .env com os mesmos valores
export $(grep -v '^#' .env | xargs)
npm run build
npx serve dist
```

## Login com Google

1. [Authentication → Sign-in method](https://console.firebase.google.com/project/prisma-gef/authentication/providers)
2. **Google** → **Ativar**
3. E-mail de suporte do projeto (obrigatório) → Salvar
4. Authorized domains: `localhost` + domínio Vercel
5. Não é necessário Client ID extra para o provedor padrão do Firebase no Web

Se o popup for bloqueado, o app tenta `signInWithRedirect` automaticamente.
