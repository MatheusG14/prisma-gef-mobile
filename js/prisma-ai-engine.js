/**
 * ==============================================================================
 * PRISMA AI INTENT ENGINE (js/prisma-ai-engine.js)
 * Motor determinístico de intenções, pontuação de confiança e respostas
 * financeiras baseadas em dados reais do Prisma GEF.
 * Compatível com Node.js (CommonJS) e navegadores (Global/Window).
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PrismaAiEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 1. Normalização de Texto (NFD, sem diacríticos, minúsculas, sem pontuação)
  function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 2. Tokenização de Palavras Inteiras
  function tokenize(text) {
    const norm = normalizeText(text);
    return norm ? norm.split(' ').filter(Boolean) : [];
  }

  // 3. Formatação Monetária pt-BR Segura
  function fmtCurrency(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 'R$ 0,00';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // 4. Catálogo de Sinônimos e Padrões por Intenção
  const INTENTS = {
    SAUDACAO: {
      id: 'saudacao',
      keywords: ['ola', 'oi', 'opa', 'hello', 'hi', 'hey', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'eai', 'salve', 'iae', 'tudo bem', 'tudo bom'],
      weight: 2.2
    },
    AGRADECIMENTO: {
      id: 'agradecimento',
      keywords: ['obrigado', 'obrigada', 'valeu', 'agradeco', 'grato', 'grata', 'show', 'otimo', 'maravilha', 'perfeito', 'obrigado pela ajuda', 'obrigada pela ajuda'],
      weight: 1.6
    },
    AJUDA: {
      id: 'ajuda',
      keywords: ['ajuda', 'socorro', 'o que voce faz', 'quem e voce', 'como funciona', 'comandos', 'menu', 'opcoes', 'instrucoes'],
      weight: 1.2
    },
    RELATORIO_PDF: {
      id: 'relatorio_pdf',
      keywords: ['pdf', 'relatorio'],
      actionVerbs: ['gerar', 'baixar', 'emitir', 'exportar', 'criar', 'fazer', 'imprimir'],
      weight: 1.8
    },
    ECONOMIA_CORTES: {
      id: 'economia_cortes',
      keywords: ['economizar', 'economia', 'cortar', 'cortes', 'reduzir', 'poupar', 'poupanca', 'onde economizar', 'onde cortar', 'reducao', 'sobrar', 'poupar mais'],
      weight: 1.5
    },
    ANALISE_GASTOS: {
      id: 'analise_gastos',
      keywords: ['analisar', 'analise', 'diagnostico', 'gastos', 'despesas', 'raio x', 'visão geral', 'fluxo', 'panorama'],
      weight: 1.2
    },
    RECEITAS: {
      id: 'receitas',
      keywords: ['receita', 'receitas', 'renda', 'salario', 'ganhei', 'quanto ganhei', 'quanto eu ganhei', 'ganhos', 'entradas', 'faturamento', 'recebimentos', 'recebi', 'quanto recebi'],
      weight: 1.4
    },
    SALDO: {
      id: 'saldo',
      keywords: ['saldo', 'quanto tenho', 'dinheiro', 'disponivel', 'saldo atual', 'saldo em conta', 'sobra', 'quanto sobrou', 'quanto dinheiro'],
      weight: 1.4
    },
    INVESTIMENTOS: {
      id: 'investimentos',
      keywords: ['investimento', 'investimentos', 'carteira', 'patrimonio', 'renda fixa', 'renda variavel', 'acoes', 'cdb', 'tesouro', 'ativos'],
      weight: 1.3
    },
    METAS: {
      id: 'metas',
      keywords: ['meta', 'metas', 'planejar', 'plano', 'objetivo', 'objetivos', 'planejamento', 'reserva de emergencia'],
      weight: 1.3
    },
    CARTOES: {
      id: 'cartoes',
      keywords: ['cartao', 'cartoes', 'fatura', 'faturas', 'limite', 'credito', 'debito', 'divida', 'dividas'],
      weight: 1.3
    },
    CATEGORIA_ALIMENTACAO: {
      id: 'categoria_gastos',
      category: 'alimentacao',
      keywords: ['alimentacao', 'comida', 'mercado', 'supermercado', 'restaurante', 'lanche', 'ifood', 'almoco', 'jantar'],
      weight: 1.4
    },
    CATEGORIA_MORADIA: {
      id: 'categoria_gastos',
      category: 'moradia',
      keywords: ['moradia', 'aluguel', 'condominio', 'luz', 'energia', 'agua', 'gas', 'internet', 'iptu'],
      weight: 1.4
    },
    CATEGORIA_TRANSPORTE: {
      id: 'categoria_gastos',
      category: 'transporte',
      keywords: ['transporte', 'gasolina', 'combustivel', 'uber', 'onibus', 'metro', 'estacionamento', 'ipva', 'carro'],
      weight: 1.4
    },
    CATEGORIA_LAZER: {
      id: 'categoria_gastos',
      category: 'lazer',
      keywords: ['lazer', 'viagem', 'passeio', 'cinema', 'streaming', 'netflix', 'spotify', 'jogos'],
      weight: 1.4
    },
    CATEGORIA_SAUDE: {
      id: 'categoria_gastos',
      category: 'saude',
      keywords: ['saude', 'farmacia', 'remedio', 'consulta', 'medico', 'dentista', 'plano de saude', 'exame'],
      weight: 1.4
    },
    COMPARAR_PERIODOS: {
      id: 'comparar_periodos',
      keywords: ['comparar', 'comparativo', 'mes passado', 'mes anterior', 'evolucao', 'diferenca'],
      weight: 1.3
    }
  };

  // 5. Motor de Classificação e Scoring
  function classifyIntent(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return { intent: 'vazio', confidence: 0, details: {} };
    }

    const norm = normalizeText(rawText);
    const tokens = tokenize(rawText);

    if (tokens.length === 0) {
      return { intent: 'vazio', confidence: 0, details: {} };
    }

    // Saudações curtas ("oi", "olá", "bom dia") têm prioridade máxima
    const greetingSet = new Set(['ola', 'oi', 'opa', 'hello', 'hi', 'hey', 'eai', 'iae', 'salve']);
    const greetingPhrases = ['bom dia', 'boa tarde', 'boa noite', 'e ai', 'eai', 'tudo bem', 'tudo bom', 'como vai'];
    const isPureGreeting =
      tokens.length <= 4 &&
      (
        tokens.every((t) => greetingSet.has(t) || t === 'prisma' || t === 'ai' || t === 'bot') ||
        greetingPhrases.some((p) => norm === p || norm.startsWith(p + ' ') || norm.endsWith(' ' + p))
      );
    if (isPureGreeting || (tokens.length <= 2 && tokens.some((t) => greetingSet.has(t)))) {
      return { intent: 'saudacao', confidence: 0.99, details: { pure: true } };
    }

    // Regra específica para RELATÓRIO PDF:
    // Só é ativado se houver o termo 'pdf'/'relatorio' E um verbo de ação explícito,
    // e NÃO houver negações expressas ("não quero", "sem pdf", etc.)
    const hasPdfTerm = tokens.includes('pdf') || tokens.includes('relatorio');
    const isNegation = norm.includes('nao ') || norm.includes('sem ') || norm.includes('nem ');
    if (hasPdfTerm && !isNegation) {
      const hasActionVerb = INTENTS.RELATORIO_PDF.actionVerbs.some(v => tokens.includes(v));
      const explicitPhrase = norm.includes('gerar pdf') || norm.includes('baixar pdf') || norm.includes('emitir pdf') || norm.includes('gerar relatorio') || norm.includes('baixar relatorio');
      if (hasActionVerb || explicitPhrase) {
        return { intent: 'relatorio_pdf', confidence: 0.95, details: { action: 'export' } };
      }
    }

    const scores = {};

    for (const [key, intentDef] of Object.entries(INTENTS)) {
      if (key === 'RELATORIO_PDF') continue; // já tratado especialmente

      let matchCount = 0;
      for (const kw of intentDef.keywords) {
        const kwTokens = kw.split(' ');
        if (kwTokens.length === 1) {
          if (tokens.includes(kwTokens[0])) {
            matchCount += 1;
          }
        } else {
          if (norm.includes(kw)) {
            matchCount += 2; // bônus para expressões exatas
          }
        }
      }

      if (matchCount > 0) {
        let score = (matchCount / Math.max(tokens.length, 1)) * intentDef.weight;
        // Bônus para categorias de despesas quando acompanhadas de termos de consumo
        if (intentDef.category && (tokens.includes('gastei') || tokens.includes('gasto') || tokens.includes('gastos') || tokens.includes('custou') || norm.includes('quanto foi'))) {
          score += 0.3;
        }
        scores[key] = {
          intent: intentDef.id,
          category: intentDef.category,
          score,
          matchCount
        };
      }
    }

    // Identificar a intenção com maior pontuação
    const candidates = Object.values(scores).sort((a, b) => b.score - a.score);

    if (candidates.length === 0 || candidates[0].score < 0.15) {
      return { intent: 'fallback', confidence: 0, details: {} };
    }

    const winner = candidates[0];

    // Resolução de empate entre economia e análise:
    // Se o usuário digitou "como economizar nos gastos", "economia" é a intenção específica
    if (winner.intent === 'analise_gastos' && candidates.some(c => c.intent === 'economia_cortes')) {
      const eco = candidates.find(c => c.intent === 'economia_cortes');
      if (eco.matchCount >= 1) {
        return { intent: 'economia_cortes', confidence: 0.9, details: {} };
      }
    }

    // Se o usuário digitou "meta" / "metas" com intenção de objetivo (ex: "criar meta de economia")
    if (tokens.includes('meta') || tokens.includes('metas')) {
      if (tokens.includes('criar') || tokens.includes('nova') || tokens.includes('definir') || norm.includes('minhas metas') || norm.includes('ver metas')) {
        return { intent: 'metas', confidence: 0.95, details: {} };
      }
    }

    return {
      intent: winner.intent,
      confidence: Math.min(Number(winner.score.toFixed(2)), 1.0),
      details: winner.category ? { category: winner.category } : {}
    };
  }

  // 6. Mensagens de Fallback Rotativas (sem repetição consecutiva)
  let _lastFallbackIndex = -1;
  const FALLBACK_MESSAGES = [
    'Não entendi com clareza a sua pergunta. Como assistente financeiro, posso calcular seus gastos, sugerir onde economizar, informar seu saldo ou detalhar categorias.',
    'Ainda estou aprendendo a interpretar essa frase de forma precisa. Experimente perguntar sobre suas despesas, oportunidades de economia ou metas financeiras.',
    'Não encontrei dados suficientes para responder a essa pergunta exata. Posso analisar suas finanças no período atual ou verificar seu saldo consolidado.'
  ];

  function getFallbackResponse() {
    let nextIdx;
    do {
      nextIdx = Math.floor(Math.random() * FALLBACK_MESSAGES.length);
    } while (nextIdx === _lastFallbackIndex && FALLBACK_MESSAGES.length > 1);
    _lastFallbackIndex = nextIdx;

    return {
      text: FALLBACK_MESSAGES[nextIdx],
      chips: [
        { label: 'Analisar meus gastos', query: 'Analisar meus gastos' },
        { label: 'Onde posso economizar?', query: 'Como posso economizar?' },
        { label: 'Qual é o meu saldo?', query: 'Qual é o meu saldo atual?' }
      ]
    };
  }

  // 7. Resolução de Resposta com Dados Reais
  function generateAnswer(query, userData = {}) {
    const classification = classifyIntent(query);
    const { intent, details } = classification;

    const receitas = Array.isArray(userData.receitas) ? userData.receitas : [];
    const despesas = Array.isArray(userData.despesas) ? userData.despesas : [];
    const contas = Array.isArray(userData.contas) ? userData.contas : [];
    const cartoes = Array.isArray(userData.cartoes) ? userData.cartoes : [];
    const investimentos = Array.isArray(userData.investimentos) ? userData.investimentos : [];
    const metas = Array.isArray(userData.goals) ? userData.goals : [];
    const periodLabel = userData.periodLabel || 'no período selecionado (últimos 30 dias)';

    // Totais Consolidados (Fonte única)
    const totalReceitas = receitas.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
    const totalDespesas = despesas.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
    const saldoContas = contas.reduce((sum, c) => sum + (Number(c.saldo) || 0), 0);
    const saldoFluxo = totalReceitas - totalDespesas;
    const taxaPoupanca = totalReceitas > 0 ? ((saldoFluxo / totalReceitas) * 100) : 0;

    switch (intent) {
      case 'saudacao': {
        const nRec = receitas.length;
        const nDesp = despesas.length;
        const nContas = contas.length;
        const hasData = nRec + nDesp + nContas > 0;
        const contextLine = hasData
          ? `Já vejo ${nRec} receita(s), ${nDesp} despesa(s) e ${nContas} conta(s) nos seus dados — posso analisar o período atual, achar cortes ou montar um plano.`
          : 'Quando você cadastrar receitas, despesas e contas, eu cruzo tudo para diagnóstico, cortes e metas.';
        return {
          intent,
          text:
            'Olá! Eu sou o **Prisma AI**, seu consultor financeiro dentro do Prisma.\n\n' +
            'Posso explicar seus gastos, comparar períodos, avaliar investimentos, acompanhar metas e gerar relatório em PDF — sempre com base nos **seus** lançamentos.\n\n' +
            contextLine +
            '\n\n**Como posso ajudar agora?**',
          chips: [
            { label: 'Analisar gastos', query: 'Analisar meus gastos' },
            { label: 'Onde economizar', query: 'Como posso economizar?' },
            { label: 'Meu saldo', query: 'Qual é o meu saldo?' },
            { label: 'Minhas metas', query: 'Ver minhas metas' }
          ]
        };
      }

      case 'agradecimento':
        return {
          intent,
          text: 'Fico feliz em ajudar! Estou sempre por aqui para manter seu orçamento equilibrado e suas metas no rumo certo. Se precisar de algo mais, é só chamar.',
          chips: [
            { label: 'Resumo geral', query: 'Visão geral das finanças' },
            { label: 'Gerar PDF', query: 'Gerar relatório em PDF' }
          ]
        };

      case 'ajuda':
        return {
          intent,
          text: 'Com o **Prisma AI**, você pode:\n\n' +
            '• **Analisar gastos:** diagnósticos completos de despesas e receitas.\n' +
            '• **Oportunidades de economia:** sugestões práticas de cortes sem atingir o essencial.\n' +
            '• **Saldo e Contas:** consolidação do dinheiro em conta corrente e carteiras.\n' +
            '• **Gastos por categoria:** consultas como *"quanto gastei com alimentação?"*.\n' +
            '• **Investimentos:** evolução patrimonial e alocação de ativos.\n' +
            '• **Relatório em PDF:** exportação executiva dos seus dados.',
          chips: [
            { label: 'Analisar gastos', query: 'Analisar meus gastos' },
            { label: 'Economizar', query: 'Como posso economizar?' },
            { label: 'Consultar saldo', query: 'Qual é o meu saldo?' }
          ]
        };

      case 'saldo':
        if (contas.length === 0 && receitas.length === 0) {
          return {
            intent,
            text: 'Você ainda não cadastrou nenhuma conta bancária nem receitas no Prisma.\n\nAcesse a seção **Contas** ou **Receitas** para registrar seus dados e acompanhar seu saldo.',
            action: { section: 'contas', label: 'Cadastrar Conta' }
          };
        }
        const patrimonioInv = investimentos.reduce((s, inv) => s + (Number(inv.valorAtual || inv.atual || inv.valor || 0)), 0);
        const patrimonioTotal = saldoContas + patrimonioInv;
        return {
          intent,
          text: `**Saldo e Patrimônio Consolidado:**\n\n` +
            `• **Saldo em Contas:** ${fmtCurrency(saldoContas)} (${contas.length} conta(s))\n` +
            `• **Investimentos (valor atual):** ${fmtCurrency(patrimonioInv)}\n` +
            `• **Patrimônio líquido aproximado:** ${fmtCurrency(patrimonioTotal)}\n` +
            `• **Fluxo do período:** ${saldoFluxo >= 0 ? '+' : '−'} ${fmtCurrency(Math.abs(saldoFluxo))} ${periodLabel}\n` +
            `• **Taxa de poupança:** ${taxaPoupanca.toFixed(1)}%\n\n` +
            (saldoFluxo >= 0
              ? 'Seu fluxo de caixa está **positivo** — ótimo momento para reforçar reserva de emergência ou aportes programados.'
              : 'Despesas superaram as receitas no período. Revise cortes e, se necessário, use o Cockpit para simular cenários.'),
          chips: [
            { label: 'Detalhar despesas', query: 'Analisar meus gastos' },
            { label: 'Onde economizar?', query: 'Como posso economizar?' },
            { label: 'Investimentos', query: 'Avaliar meus investimentos' }
          ]
        };

      case 'receitas':
        if (receitas.length === 0) {
          return {
            intent,
            text: 'Nenhuma receita foi registrada para este período.\n\nClique no botão abaixo para adicionar salários, honorários ou outros rendimentos.',
            action: { section: 'receitas', label: 'Cadastrar Receita' }
          };
        }
        return {
          intent,
          text: `**Receitas Registradas (${periodLabel}):**\n\n` +
            `• **Total de Entradas:** ${fmtCurrency(totalReceitas)}\n` +
            `• **Lançamentos:** ${receitas.length} registro(s)\n` +
            `• **Média por lançamento:** ${fmtCurrency(totalReceitas / receitas.length)}\n\n` +
            `Mantenha suas receitas atualizadas para que o cálculo de taxa de poupança seja exato.`,
          chips: [
            { label: 'Analisar despesas', query: 'Analisar meus gastos' },
            { label: 'Metas financeiras', query: 'Ver minhas metas' }
          ]
        };

      case 'analise_gastos':
        if (despesas.length === 0 && receitas.length === 0) {
          return {
            intent,
            text: 'Você ainda não possui transações registradas no período.\n\nAdicione suas receitas e despesas nas respectivas seções para receber um diagnóstico completo.',
            action: { section: 'despesas', label: 'Cadastrar Despesas' }
          };
        }
        // Contexto avançado: top categorias, ticket médio, saúde
        const byCat = {};
        despesas.forEach(d => {
          const c = (d.categoria || d.category || 'Outros').trim() || 'Outros';
          byCat[c] = (byCat[c] || 0) + (Number(d.valor) || 0);
        });
        const topCats = Object.entries(byCat)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([nome, val], i) => `${i + 1}. **${nome}**: ${fmtCurrency(val)} (${totalDespesas > 0 ? ((val / totalDespesas) * 100).toFixed(1) : 0}%)`);
        const ticketMedio = despesas.length > 0 ? totalDespesas / despesas.length : 0;
        const saudeLabel = taxaPoupanca >= 20 ? 'Excelente' : taxaPoupanca >= 10 ? 'Boa' : taxaPoupanca >= 0 ? 'Atenção' : 'Crítica';
        const sa = userData.spendAlerts && Array.isArray(userData.spendAlerts.alerts) ? userData.spendAlerts.alerts : [];
        const saBlock = sa.length
          ? `\n\n**Alertas de gastos em tempo real (${sa.length}):**\n` +
            sa.slice(0, 3).map((a, i) => `${i + 1}. **${a.titulo}** — ${a.mensagem || ''}`).join('\n')
          : '';
        return {
          intent,
          text: `**Diagnóstico Financeiro Avançado (${periodLabel}):**\n\n` +
            `• **Receitas:** ${fmtCurrency(totalReceitas)}\n` +
            `• **Despesas:** ${fmtCurrency(totalDespesas)} (${despesas.length} lançamentos | ticket médio ${fmtCurrency(ticketMedio)})\n` +
            `• **Fluxo líquido:** ${saldoFluxo >= 0 ? '+' : '−'} ${fmtCurrency(Math.abs(saldoFluxo))}\n` +
            `• **Taxa de poupança:** ${taxaPoupanca.toFixed(1)}% — **Saúde: ${saudeLabel}**\n\n` +
            (topCats.length
              ? `**Top categorias de gasto:**\n${topCats.join('\n')}\n\n`
              : '') +
            (taxaPoupanca >= 20
              ? 'Parabéns! Sua taxa de poupança está acima da meta recomendada de 20%. Considere direcionar o excedente para metas ou investimentos.'
              : taxaPoupanca >= 10
                ? 'Boa base. Busque aproximar-se de 20% de poupança cortando gastos discricionários nas categorias líderes.'
                : 'Priorize reduzir despesas não essenciais e revisar as categorias com maior peso para recuperar margem de poupança.') +
            saBlock,
          chips: [
            { label: 'Onde posso economizar?', query: 'Como posso economizar?' },
            { label: 'Gerar relatório PDF', query: 'Gerar relatório em PDF' },
            { label: 'Investimentos', query: 'Avaliar meus investimentos' }
          ]
        };

      case 'economia_cortes': {
        let recs = Array.isArray(userData.recommendations) ? userData.recommendations : [];
        // Se ainda não houver recomendações pré-calculadas, monta a partir das despesas reais
        if (!recs.length && despesas.length) {
          const byCat = {};
          despesas.forEach((d) => {
            const c = String(d.categoria || d.category || 'Outros').trim() || 'Outros';
            byCat[c] = (byCat[c] || 0) + (Number(d.valor) || 0);
          });
          const total = Object.values(byCat).reduce((a, b) => a + b, 0) || 1;
          recs = Object.entries(byCat)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([categoria, valor]) => {
              const pct = (valor / total) * 100;
              const corte = pct > 30 ? 0.2 : pct > 15 ? 0.12 : 0.08;
              return {
                titulo: `Otimizar ${categoria}`,
                categoria,
                economiaPotencial: Math.round(valor * corte),
                percentualReducao: Math.round(corte * 100),
                acaoRecomendada: `Definir teto mensal e revisar lançamentos de ${categoria}`
              };
            })
            .filter((r) => r.economiaPotencial > 0);
        }
        if (recs.length > 0) {
          const top3 = recs.slice(0, 3);
          const totalEco = top3.reduce((s, r) => s + (Number(r.economiaPotencial) || 0), 0);
          return {
            intent,
            text: `**Oportunidades de economia (baseadas nos seus lançamentos):**\n\n` +
              `Potencial estimado de até **${fmtCurrency(totalEco)}/mês** ao ajustar as categorias com maior peso:\n\n` +
              top3.map((r, i) => `${i + 1}. **${r.titulo || r.categoria}** (${r.categoria || 'Geral'})\n   Economia estimada: **${fmtCurrency(r.economiaPotencial)}/mês** (−${r.percentualReducao || 10}%)\n   *Ação:* ${r.acaoRecomendada || 'Ajustar categoria'}`).join('\n\n') +
              `\n\nOs valores usam apenas despesas cadastradas. Posso detalhar qualquer categoria se você perguntar, por exemplo: *"quanto gastei com alimentação?"*.`,
            chips: [
              { label: 'Analisar gastos', query: 'Analisar meus gastos' },
              { label: 'Ver metas', query: 'Ver minhas metas' },
              { label: 'Meu saldo', query: 'Qual é o meu saldo?' }
            ]
          };
        }
        if (totalDespesas === 0) {
          return {
            intent,
            text: 'Você não tem despesas cadastradas no momento. Cadastre seus lançamentos na seção **Despesas** para eu indicar onde cortar com segurança.',
            action: { section: 'despesas', label: 'Nova Despesa' }
          };
        }
        return {
          intent,
          text: `Seus gastos estão relativamente equilibrados ${periodLabel}.\n\nNão há concentração extrema em uma única categoria. Continue registrando despesas para recomendações mais precisas.`,
          chips: [
            { label: 'Ver investimentos', query: 'Avaliar meus investimentos' },
            { label: 'Metas de poupança', query: 'Ver minhas metas' }
          ]
        };
      }

      case 'categoria_gastos':
        const targetCategory = details.category || 'geral';
        const normCat = normalizeText(targetCategory);
        const filteredDespesas = despesas.filter(d => {
          const cat = normalizeText(d.categoria || d.category || '');
          const desc = normalizeText(d.descricao || d.description || '');
          return cat.includes(normCat) || desc.includes(normCat);
        });
        const catTotal = filteredDespesas.reduce((s, d) => s + (Number(d.valor) || 0), 0);
        const catPct = totalDespesas > 0 ? (catTotal / totalDespesas) * 100 : 0;

        return {
          intent,
          text: `**Gastos com ${targetCategory.toUpperCase()} (${periodLabel}):**\n\n` +
            `• **Total gasto:** ${fmtCurrency(catTotal)}\n` +
            `• **Lançamentos:** ${filteredDespesas.length} item(ns)\n` +
            `• **Impacto nas despesas totais:** ${catPct.toFixed(1)}%\n\n` +
            (filteredDespesas.length > 0
              ? 'Consulte os lançamentos detalhados na aba **Despesas** para ver cada comprovante.'
              : 'Nenhum lançamento identificado para esta categoria no período ativo.'),
          chips: [
            { label: 'Onde economizar?', query: 'Como posso economizar?' },
            { label: 'Outras categorias', query: 'Analisar meus gastos' }
          ]
        };

      case 'investimentos':
        if (investimentos.length === 0) {
          return {
            intent,
            text: 'Você ainda não cadastrou ativos de investimento na sua carteira.\n\nAcesse a seção **Investimentos** para registrar ativos em Renda Fixa, Ações, FIIs ou Tesouro Direto.',
            action: { section: 'investimentos', label: 'Cadastrar Ativos' }
          };
        }
        const totalInvestido = investimentos.reduce((s, i) => s + (Number(i.valorAtual || i.valorAplicado || i.valor || 0)), 0);
        const totalAplicado = investimentos.reduce((s, i) => s + (Number(i.valorAplicado || i.valor || 0)), 0);
        const lucro = totalInvestido - totalAplicado;
        const rentabilidade = totalAplicado > 0 ? (lucro / totalAplicado) * 100 : 0;

        return {
          intent,
          text: `**Diagnóstico da Carteira de Investimentos:**\n\n` +
            `• **Patrimônio Investido:** ${fmtCurrency(totalInvestido)}\n` +
            `• **Total Aplicado:** ${fmtCurrency(totalAplicado)}\n` +
            `• **Resultado Acumulado:** ${lucro >= 0 ? '+' : '−'} ${fmtCurrency(Math.abs(lucro))} (${rentabilidade.toFixed(2)}%)\n` +
            `• **Ativos Registrados:** ${investimentos.length} posição(ões)\n\n` +
            `*Recomendação:* Mantenha sua carteira diversificada e revise seus aportes periodicamente.`,
          chips: [
            { label: 'Metas de patrimônio', query: 'Ver minhas metas' },
            { label: 'Relatório completo', query: 'Gerar relatório em PDF' }
          ]
        };

      case 'metas':
        if (metas.length === 0) {
          return {
            intent,
            text: 'Você não tem metas cadastradas no momento.\n\nDefina objetivos (ex.: Reserva de Emergência, Viagem, Aposentadoria) na seção **Metas** para acompanhar seu progresso.',
            action: { section: 'metas', label: 'Criar Meta' }
          };
        }
        const totalAlvo = metas.reduce((s, m) => s + (Number(m.alvo || m.target || 0)), 0);
        const totalAtualMetas = metas.reduce((s, m) => s + (Number(m.atual || m.current || 0)), 0);
        const progressoGeral = totalAlvo > 0 ? (totalAtualMetas / totalAlvo) * 100 : 0;

        return {
          intent,
          text: `**Progresso das Metas Financeiras:**\n\n` +
            `• **Metas ativas:** ${metas.length} objetivo(s)\n` +
            `• **Valor acumulado:** ${fmtCurrency(totalAtualMetas)} de ${fmtCurrency(totalAlvo)}\n` +
            `• **Progresso consolidado:** ${progressoGeral.toFixed(1)}%\n\n` +
            `Continue direcionando seu saldo livre para concluir suas metas mais prioritárias.`,
          chips: [
            { label: 'Onde economizar?', query: 'Como posso economizar?' },
            { label: 'Ver saldo', query: 'Qual é o meu saldo?' }
          ]
        };

      case 'cartoes':
        if (cartoes.length === 0) {
          return {
            intent,
            text: 'Nenhum cartão cadastrado. Registre seus cartões na seção **Cartões** para acompanhar limites e faturas.',
            action: { section: 'cartoes', label: 'Cadastrar Cartão' }
          };
        }
        const limiteTotal = cartoes.reduce((s, c) => s + (Number(c.limite || 0)), 0);
        return {
          intent,
          text: `💳 **Cartões e Limites:**\n\n` +
            `• **Cartões cadastrados:** ${cartoes.length} cartão(ões)\n` +
            `• **Limite total disponível:** ${fmtCurrency(limiteTotal)}\n\n` +
            `Mantenha o pagamento das faturas em dia para evitar juros rotativos.`,
          chips: [
            { label: 'Analisar gastos', query: 'Analisar meus gastos' },
            { label: 'Ver saldo', query: 'Qual é o meu saldo?' }
          ]
        };

      case 'comparar_periodos':
        return {
          intent,
          text: `🔄 **Comparativo de Períodos:**\n\n` +
            `• **Período atual:** ${periodLabel}\n` +
            `• **Receitas atuais:** ${fmtCurrency(totalReceitas)}\n` +
            `• **Despesas atuais:** ${fmtCurrency(totalDespesas)}\n\n` +
            `Você pode alterar o período nos botões de filtro no topo do Prisma AI para comparar diferentes intervalos.`,
          chips: [
            { label: 'Analisar gastos', query: 'Analisar meus gastos' },
            { label: 'Gerar PDF', query: 'Gerar relatório em PDF' }
          ]
        };

      case 'relatorio_pdf':
        return {
          intent,
          text: 'Preparando o seu **relatório executivo em PDF** com os dados financeiros do período selecionado...',
          action: { type: 'generate_pdf' }
        };

      case 'vazio':
        return {
          intent,
          text: 'Digite uma pergunta ou escolha uma das opções rápidas abaixo para conversarmos sobre suas finanças.',
          chips: [
            { label: 'Analisar gastos', query: 'Analisar meus gastos' },
            { label: 'Onde economizar?', query: 'Como posso economizar?' },
            { label: 'Qual é o meu saldo?', query: 'Qual é o meu saldo?' }
          ]
        };

      case 'fallback':
      default:
        const fb = getFallbackResponse();
        return {
          intent: 'fallback',
          text: fb.text,
          chips: fb.chips
        };
    }
  }

  return {
    normalizeText,
    tokenize,
    classifyIntent,
    generateAnswer,
    INTENTS
  };
});
