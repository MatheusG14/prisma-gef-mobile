# Prisma — Gestão e Educação Financeira

Aplicação web para organização financeira pessoal, acompanhamento patrimonial e
educação financeira. O Prisma reúne dashboard, receitas, despesas, contas,
cartões, metas, investimentos, relatórios, trilhas educacionais e recursos do
Prisma AI em uma única interface.

## Visão geral

O projeto oferece:

- Dashboard com indicadores financeiros e visão consolidada;
- cadastro e acompanhamento de receitas e despesas;
- gerenciamento de contas, cartões e transações;
- metas financeiras e acompanhamento de evolução;
- carteira de ativos e investimentos;
- centro financeiro com indicadores, histórico e projeções;
- relatórios e busca global;
- trilha de educação financeira com guias em PDF;
- Prisma AI para planos e análises financeiras;
- consentimento e histórico relacionados à LGPD;
- backend opcional com autenticação, sessões e persistência em SQLite.

> O Prisma é uma ferramenta de organização e educação financeira. Seus
> indicadores são informativos e não substituem orientação profissional,
> contábil ou de investimentos.

## Tecnologias

- HTML5, CSS3 e JavaScript;
- Node.js 20 ou superior;
- servidor HTTP nativo do Node.js;
- SQLite com modo WAL;
- testes nativos com `node:test`;
- Firebase Authentication e Cloud Firestore para contas e dados sincronizados;
- autenticação do backend com `scrypt`, sessões e cookies `HttpOnly`.

## Pré-requisitos

- Node.js 20 ou superior;
- npm;
- navegador moderno com suporte a JavaScript e aos mecanismos de armazenamento do Firebase Authentication.

Node.js 22 ou 24 é recomendado para desenvolvimento.

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/MatheusG14/prisma-gestao-educacao-financeira.git
cd prisma-gestao-educacao-financeira
npm install
```

O projeto atualmente possui dependências mínimas e utiliza recursos nativos do
Node.js.

## Execução

### Servidor backend

```bash
npm start
```

Por padrão, o servidor fica disponível em:

```text
http://localhost:3000
```

Também é possível iniciar o backend no Windows executando
`START_BACKEND.bat`.

Para iniciar a versão de desenvolvimento:

```bash
npm run dev
```

A porta pode ser alterada com a variável `PORT`:

```bash
PORT=3009 npm start
```

No Windows PowerShell:

```powershell
$env:PORT=3009
npm start
```

### Interface estática

O arquivo `index.html` também pode ser aberto em um servidor estático. Para
utilizar os recursos que dependem do backend, execute `npm start` e acesse a
URL pelo navegador.

No Windows, o arquivo `INICIAR_PRISMA.bat` pode ser usado para iniciar o
projeto conforme a configuração local.

## Configuração opcional

Copie `.env.example` para `.env` e preencha somente os serviços que deseja
ativar. O sistema funciona sem configuração de e-mail.

```bash
copy .env.example .env
```

As configurações opcionais incluem:

- SMTP para recuperação de senha e envio de PDFs;
- limites de envio de PDFs;
- duração das sessões;
- URL pública da aplicação;
- administrador inicial.

Nunca versionar senhas, tokens ou credenciais reais. O arquivo `.env` deve
permanecer fora do repositório.

## Firebase e persistência

O cliente usa Firebase Authentication para cadastro, login, recuperação de
senha, logout e sessão. A persistência tenta `browserLocalPersistence` e usa
`browserSessionPersistence` quando o navegador bloqueia o armazenamento local.
Senhas e hashes de senha não são gravados pelo Prisma no armazenamento do
navegador.

Os dados do perfil, estado financeiro e consentimento ficam em documentos
Firestore sob `users/{uid}`. As regras em `firestore.rules` limitam o acesso ao
UID autenticado. O Prisma não usa Firebase Storage porque não há atualmente
arquivos de usuário que precisem ser armazenados ali.

Contas e perfis legados no navegador são consultados somente para oferecer uma
migração confirmada dos dados financeiros locais. Os registros de origem não
são apagados. A base SQLite do servidor e as contas antigas do backend não são
migradas automaticamente.

### Publicação estática na Netlify

1. No Firebase Console, habilite o provedor **E-mail/senha** em Authentication,
   crie o banco Cloud Firestore e publique as regras de `firestore.rules`.
2. Em Authentication, adicione o domínio de produção da Netlify e os domínios
   de preview que serão usados como domínios autorizados.
3. Configure estas variáveis de ambiente no site Netlify:
   `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
   `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID` e `FIREBASE_APP_ID`.
   A configuração Web é pública; não coloque chaves de conta de serviço ou
   credenciais administrativas nessas variáveis.
4. A Netlify executa `npm run build:netlify` e publica `dist`. Para testar a
   build localmente, use os mesmos nomes de variáveis antes de executar esse
   comando. A build falha intencionalmente quando faltam `FIREBASE_API_KEY`,
   `FIREBASE_MESSAGING_SENDER_ID` ou `FIREBASE_APP_ID`.

O servidor `server.js` e o SQLite continuam disponíveis para desenvolvimento
local, mas a publicação estática não executa esse servidor. Endpoints ainda
dependentes de `/api` (por exemplo, e-mail/PDFs e administração) precisam de
uma implantação de backend compatível, como Netlify Functions, antes de serem
considerados disponíveis na Netlify.

## API principal

O backend expõe, entre outros, os seguintes recursos:

| Grupo | Recursos |
|---|---|
| Saúde | `GET /api/health` |
| Autenticação | registro, login, logout, sessão e recuperação de senha |
| Estado financeiro | `GET/PUT /api/state` |
| Prisma AI | estado, planos e análises |
| LGPD | consentimento e histórico |
| Conta | atualização e exclusão da conta |
| Insights | consulta e registro de insights |

As rotas protegidas exigem uma sessão autenticada.

## Testes

Execute a suíte principal:

```bash
npm test
```

Os testes cobrem persistência, autenticação, sessões, estado financeiro,
dashboard, modais, finance engine, monitoramento, Prisma AI e visualização de
PDFs.

Execute as auditorias:

```bash
npm run test:audit
```

As auditorias verificam:

- segurança e isolamento por usuário no backend;
- IDs duplicados e contratos `data-section`;
- equilíbrio e responsividade das folhas CSS;
- ícones e estrutura das telas HTML.

Para executar somente os testes de autenticação:

```bash
npm run test:auth
```

## Estrutura do projeto

```text
.
├── assets/
│   ├── images/                  # Logos, favicons e imagens
│   └── pdfs/                    # PDFs usados pelos recursos da aplicação
├── conteudos/
│   └── educacao-financeira/     # Guias educacionais em PDF
├── css/                         # Folhas de estilo da aplicação
├── js/                          # Scripts, módulos e motores financeiros
├── telas/                       # Telas HTML carregadas pela aplicação
│   └── components/              # Navbar, sidebar e modais reutilizáveis
├── tests/                       # Testes automatizados e auditorias
├── index.html                   # Interface principal
├── server.js                    # Backend HTTP e API
├── prisma.sqlite                # Banco SQLite local
├── package.json                 # Scripts e metadados npm
├── .env.example                 # Modelo de configuração
└── README.md                    # Esta documentação
```

## Banco de dados

O arquivo `prisma.sqlite` é o banco local da aplicação. Os arquivos
`prisma.sqlite-shm` e `prisma.sqlite-wal` são arquivos auxiliares do modo WAL
do SQLite.

Faça cópias de segurança do banco antes de operações de manutenção. Não
compartilhe o banco se ele contiver dados financeiros reais.

## Segurança e privacidade

- não armazene credenciais no código;
- use `.env` para configurações sensíveis;
- use HTTPS e configuração de produção adequada ao publicar a aplicação;
- não trate a autenticação exclusivamente frontend como controle de acesso;
- proteja backups do SQLite;
- revise as configurações SMTP antes de habilitar envio de e-mails;
- os dados financeiros inseridos pertencem ao usuário e devem ser tratados
  como informação sensível.

## Autores

Projeto criado por:

- **Matheus Gomes Costa Teixeira**
- **Erick Bruno Ferreira dos Santos**
- **Luan Rodrigues de Souza**
- **Tiago Mendes Ferreira**
- **Michael Fernando Santos Guimarães**

## Licença

Este repositório não declara uma licença de código aberto. Consulte os
autores antes de redistribuir, modificar ou utilizar o projeto fora do
contexto autorizado.


## DevOps, PWA e mobile

Veja [docs/DEVOPS.md](docs/DEVOPS.md) para CI/CD, Netlify, Vercel, Playwright, Lighthouse, Capacitor e backup Firestore.

Responsividade mobile: `css/responsive.css`. PWA: `manifest.webmanifest`, `sw.js`.
