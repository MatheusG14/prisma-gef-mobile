# Guia de Componentes e Design System — Prisma GEF

**Versão:** 1.0.0 — Mobile-First & Acessibilidade  
**Plataforma:** HTML5, CSS3 Puro, JavaScript Vanilla (sem frameworks)  
**Público-alvo:** Frontend, Mobile UX/UI, QA e Engenharia de Produto

---

## 1. Princípios de Experiência e Hierarquia Visual

1. **Uma Pergunta por Card:** Cada card responde exatamente a uma pergunta do usuário (ex.: *"Quanto sobrou este mês?"*, *"Qual é meu patrimônio total?"*).
2. **Hierarquia de Tela:** Cada seção do Prisma possui:
   - **1 Título Principal** (`h1` ou `h2` claro com kicker temático)
   - **1 Ação Primária em Destaque** (botão com verbo explícito, ex.: *"Nova Despesa"*, *"Cadastrar Meta"*)
   - **No máximo 2 Ações Secundárias** (ex.: *"Filtrar período"*, *"Exportar"*)
3. **Sem Ambiguidade Numérica:** Todo número financeiro exibe obrigatoriamente:
   - **Sinal Explícito:** `+` para entradas/receitas, `−` para saídas/despesas
   - **Unidade Monetária:** `R$` formatado no padrão pt-BR (`R$ 1.250,00`)
   - **Período Claro:** Subtítulo indicando o escopo (ex.: *"no mês atual"*, *"últimos 30 dias"*, *"acumulado da carteira"*)
4. **Sem Truncamento Indevido:** Números e métricas de KPI nunca são truncados com reticências (`...`). A tipografia utiliza `clamp()` e quebra inteligente para caber integralmente em telas de 320px até 1920px.

---

## 2. Semântica de Cores e Ícones

A cor nunca é o único indicador de estado; acompanha sempre sinal, ícone ou texto explicativo para conformidade WCAG 2.1 AA.

| Significado | Cor Hex | Variável CSS | Ícone Lucide Padrão | Sinal | Exemplo de Aplicação |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Receita / Positivo / Lucro** | `#22C55E` | `--finance-positive` | `trending-up`, `arrow-down-left` | `+` | Receitas, rendimentos, saldo positivo |
| **Despesa / Negativo / Atraso** | `#EF4444` | `--finance-negative` | `trending-down`, `arrow-up-right` | `−` | Despesas, faturas em débito, saldo negativo |
| **Atenção / Limite / Pendência** | `#F59E0B` | `--finance-warning` | `alert-triangle`, `clock` | `!` | Vencimento próximo, limite atingido |
| **Neutro / Ação / Navegação** | `#3B82F6` | `--finance-neutral` | `landmark`, `wallet`, `arrow-right` | — | Ações primárias, links, saldo neutro |
| **Investimentos / Patrimônio** | `#A78BFA` | `--purple` | `line-chart`, `shield-check` | — | Alocação de ativos, reserva, score |

---

## 3. Tabela de Termos Unificados

Para evitar confusão entre Dashboard, Centro Financeiro, Relatórios, PDF e Prisma AI, os seguintes termos foram padronizados:

| Conceito | Termo Único Padronizado | Termos Proibidos / Descontinuados |
| :--- | :--- | :--- |
| **Dinheiro em contas correntes/carteiras** | **Saldo em Contas** | *Saldo Disponível*, *Saldo Atual da Carteira*, *Saldo Livre* |
| **Entradas no período ativo** | **Receitas do Mês** (ou do Período) | *Entradas*, *Ganhos*, *Créditos* |
| **Saídas no período ativo** | **Despesas do Mês** (ou do Período) | *Saídas*, *Gastos*, *Débitos* |
| **Diferença (Receitas − Despesas)** | **Fluxo de Caixa Líquido** | *Economia do mês*, *Resultado do Fluxo*, *Saldo do Fluxo* |
| **Ativos totais menos passivos** | **Patrimônio Líquido** | *Total em Bens*, *Fortuna*, *Saldo Patrimonial* |
| **Proporção poupada** | **Taxa de Poupança** | *Índice de Sobra*, *Percentual Guardado* |
| **Oportunidade calculada pela IA** | **Potencial de Economia** | *Corte sugerido*, *Gasto excessivo* |

---

## 4. Anatomia Padrão dos Cards

### 4.1 Card de Métrica / KPI Financeiro
```html
<article class="card stat-card" aria-label="Métrica de Fluxo de Caixa">
  <div class="stat-header">
    <span class="stat-icon val-positive">
      <i data-lucide="arrow-left-right"></i>
    </span>
    <span class="stat-badge badge-neutral" aria-label="Período de referência">
      Novembro / 2026
    </span>
  </div>
  <p class="stat-label">Fluxo de Caixa Líquido</p>
  <h2 class="stat-value val-positive">+ R$ 1.850,00</h2>
  <p class="stat-detail">Receitas menos despesas no mês</p>
</article>
```

### 4.2 Card de Item em Lista de Lançamentos
```html
<div class="movement-item" role="listitem">
  <div class="movement-icon-wrap expense">
    <i data-lucide="shopping-bag" aria-hidden="true"></i>
  </div>
  <div class="movement-info">
    <strong class="movement-title">Supermercado Central</strong>
    <span class="movement-meta">Alimentação · 15/11/2026 · Cartão Débito</span>
  </div>
  <div class="movement-amount val-negative">
    - R$ 342,80
  </div>
</div>
```

---

## 5. Estados Obrigatórios de Interface

### 5.1 Estado Carregando (Skeleton Loader)
```html
<div class="card stat-card skeleton" aria-busy="true" aria-label="Carregando dados...">
  <div class="skeleton-header"></div>
  <div class="skeleton-title"></div>
  <div class="skeleton-value"></div>
</div>
```

### 5.2 Estado Vazio (Empty State)
Todo estado vazio deve explicar a ausência de dados e conter uma ação primária para começar:
```html
<div class="section-empty" role="region" aria-label="Nenhuma receita cadastrada">
  <div class="empty-icon"><i data-lucide="inbox"></i></div>
  <h3>Nenhuma receita cadastrada</h3>
  <p>Registre seus salários, rendimentos e outras fontes de renda deste período.</p>
  <button type="button" class="btn primary" id="btnNovaReceitaEmpty">
    <i data-lucide="plus"></i> Nova Receita
  </button>
</div>
```

### 5.3 Estado de Erro com Ação de Recuperação
```html
<div class="section-error" role="alert">
  <div class="error-icon"><i data-lucide="alert-circle"></i></div>
  <h3>Não foi possível carregar os dados</h3>
  <p>Verifique sua conexão ou tente novamente em instantes.</p>
  <button type="button" class="btn secondary" onclick="window.recalculateAll()">
    <i data-lucide="rotate-cw"></i> Tentar novamente
  </button>
</div>
```

### 5.4 Estado de Sucesso (Toast Discreto)
Notificação acessível temporária (aria-live polite):
```html
<div id="toast" class="toast show" role="status" aria-live="polite">
  <span class="toast-text">Receita cadastrada com sucesso!</span>
</div>
```

---

## 6. Ações Destrutivas e Confirmação

1. Botões de exclusão utilizam a classe `.btn-danger` ou `.btn-delete`.
2. Estão separados das ações primárias por margem ou posicionamento oposto.
3. Exigem confirmação explícita antes de qualquer deleção com modal ou prompt verbal (*"Excluir despesa 'Aluguel' de R$ 1.800,00?"*).
4. Textos de botões de ação nunca utilizam apenas "OK":
   - Positivo: *"Salvar Receita"*, *"Adicionar Meta"*, *"Confirmar Transferência"*
   - Destrutivo: *"Excluir Despesa"*, *"Remover Cartão"*
   - Cancelamento: *"Cancelar"*, *"Voltar"*

---

## 7. Responsividade e Densidade Mobile

- Em larguras `< 768px`, as grades de cartões organizam-se em **1 coluna** vertical (máximo de 2 colunas exclusivamente para pares de KPIs curtos numéricos).
- Espaçamento padrão de **12px a 16px** entre cartões.
- Tabelas financeiras em mobile encapsuladas em containers com rolagem horizontal independente (`.table-responsive`), preservando o cabeçalho e alinhando valores numéricos à direita.
