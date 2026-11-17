# Deploy e debug de variáveis na Vercel

## Variáveis obrigatórias (Build)

| Nome | Obrigatória |
|------|-------------|
| `FIREBASE_API_KEY` | sim |
| `FIREBASE_MESSAGING_SENDER_ID` | sim |
| `FIREBASE_APP_ID` | sim |
| `FIREBASE_AUTH_DOMAIN` | recomendada |
| `FIREBASE_PROJECT_ID` | recomendada |
| `FIREBASE_STORAGE_BUCKET` | recomendada |

## Como configurar (UI)

1. Vercel → seu projeto → **Settings** → **Environment Variables**
2. Adicione cada nome **exatamente** como na tabela (case-sensitive)
3. Marque **Production**, **Preview** e **Development**
4. Em versões recentes da Vercel, garanta que a variável está disponível para **Build**
5. **Save**
6. **Deployments** → ⋮ no deploy atual → **Redeploy** → desmarque cache se possível

## Checklist de debug

### A) Log do build
No deploy → **Building** → logs. Procure:

```text
=== Prisma build · diagnóstico de ambiente ===
Host CI: Vercel
  ✓ FIREBASE_API_KEY=AIzaSy…xxxx (len=39)
  ✓ FIREBASE_MESSAGING_SENDER_ID=…
  ✓ FIREBASE_APP_ID=…
```

- Se aparecer `✗ … (AUSENTE)` → a variável **não** chegou ao build (nome errado, ambiente errado ou só Runtime).
- Se o build falhar com `Build do Prisma interrompido` → faltam obrigatórias.

### B) Arquivo gerado no site
Abra no browser (após deploy com sucesso):

```text
https://SEU-DOMINIO.vercel.app/build-env-debug.json
https://SEU-DOMINIO.vercel.app/js/firebase-config.js
```

- `build-env-debug.json` → `firebase.apiKey: true` e máscaras preenchidas  
- `firebase-config.js` → `apiKey` **não** pode ser `""`

### C) Runtime (opcional)
```text
https://SEU-DOMINIO.vercel.app/api/debug-env
```
Mostra se as vars existem no **runtime** das Functions (não substitui o build).

### D) Console do browser
```js
window.PRISMA_FIREBASE_CONFIG
window.PrismaFirebase?.isConfigured
```

## Erros comuns

| Sintoma | Causa | Correção |
|---------|--------|----------|
| Build falha “Configure as variáveis Firebase” | Env ausente no Build | Criar vars + Redeploy sem cache |
| Site sobe mas `apiKey: ''` | Deploy antigo ou output não é `dist` | Conferir Output Directory = `dist` e rebuild |
| Login “módulo Firebase” / config incompleta | Config vazia no front | Corrigir build (A/B) |
| Login config ok mas auth falha | Domínio não autorizado | Firebase → Auth → Authorized domains → `*.vercel.app` |
| Preview quebra, Production ok | Vars só em Production | Marcar também **Preview** |

## CLI

```bash
vercel env ls
vercel env add FIREBASE_API_KEY
vercel env pull .env.local   # só local
vercel --prod
```

## Firebase Authorized domains

Após o primeiro deploy, adicione em Authentication → Settings → Authorized domains:

- `SEU-PROJETO.vercel.app`
- domínio customizado, se houver
