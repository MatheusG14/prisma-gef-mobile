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
      keywords: ['ola', 'oi', 'opa', 'hello', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'hey'],
      weight: 1.0
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
        { label: '📊 Analisar meus gastos', query: 'Analisar meus gastos' },
        { label: '💡 Onde posso economizar?', query: 'Como posso economizar?' },
        { label: '💰 Qual é o meu saldo?', query: 'Qual é o meu saldo atual?' }
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
      case 'saudacao':
        return {
          intent,
          text: 'Olá! Sou o **Prisma AI**, seu consultor financeiro inteligente. Como posso ajudar com suas finanças hoje?',
          chips: [
            { label: '📊 Analisar gastos', query: 'Analisar meus gastos' },
            { label: '💡 Dicas de economia', query: 'Como posso economizar?' },
            { label: '🎯 Minhas metas', query: 'Ver minhas metas' }
          ]
        };

      case 'agradecimento':
        return {
          intent,
          text: 'Fico feliz em ajudar! Estou sempre por aqui para manter seu orçamento equilibrado e suas metas no rumo certo. Se precisar de algo mais, é só chamar.',
          chips: [
            { label: '📊 Resumo geral', query: 'Visão geral das finanças' },
            { label: '📄 Gerar PDF', query: 'Gerar relatório em PDF' }
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
            { label: '📊 Analisar gastos', query: 'Analisar meus gastos' },
            { label: '💡 Economizar', query: 'Como posso economizar?' },
            { label: '💰 Consultar saldo', query: 'Qual é o meu saldo?' }
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
        return {
          intent,
          text: `💰 **Saldo Financeiro Consolidado:**\n\n` +
            `• **Saldo em Contas:** ${fmtCurrency(saldoContas)} (${contas.length} conta(s) registrada(s))\n` +
            `• **Fluxo do Período:** ${saldoFluxo >= 0 ? '+' : '−'} ${fmtCurrency(Math.abs(saldoFluxo))} ${periodLabel}\n\n` +
            (saldoFluxo >= 0
              ? 'Seu fluxo de caixa está **positivo**, o que favorece a formação de reserva ou novos aportes!'
              : '⚠️ Atenção: Suas despesas superaram as receitas no período selecionado.'),
          chips: [
            { label: '📉 Detalhar despesas', query: 'Analisar meus gastos' },
            { label: '💡 Onde economizar?', query: 'Como posso economizar?' }
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
          text: `📈 **Receitas Registradas (${periodLabel}):**\n\n` +
            `• **Total de Entradas:** ${fmtCurrency(totalReceitas)}\n` +
            `• **Lançamentos:** ${receitas.length} registro(s)\n` +
            `• **Média por lançamento:** ${fmtCurrency(totalReceitas / receitas.length)}\n\n` +
            `Mantenha suas receitas atualizadas para que o cálculo de taxa de poupança seja exato.`,
          chips: [
            { label: '📊 Analisar despesas', query: 'Analisar meus gastos' },
            { label: '🎯 Metas financeiras', query: 'Ver minhas metas' }
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
        return {
          intent,
          text: `📊 **Diagnóstico Financeiro do Prisma AI:**\n\n` +
            `• **Receitas no período:** ${fmtCurrency(totalReceitas)}\n` +
            `• **Despesas totais:** ${fmtCurrency(totalDespesas)} (${despesas.length} lançamentos)\n` +
            `• **Fluxo de caixa líquido:** ${saldoFluxo >= 0 ? '+' : '−'} ${fmtCurrency(Math.abs(saldoFluxo))}\n` +
            `• **Taxa de poupança atual:** ${taxaPoupanca.toFixed(1)}%\n\n` +
            (taxaPoupanca >= 20
              ? '🎉 Parabéns! Sua taxa de poupança está acima da meta recomendada de 20%!'
              : '💡 Dica: Busque poupar pelo menos 10% a 20% das suas receitas mensais para sua reserva de emergência.'),
          chips: [
            { label: '💡 Onde posso economizar?', query: 'Como posso economizar?' },
            { label: '📄 Gerar relatório PDF', query: 'Gerar relatório em PDF' }
          ]
        };

      case 'economia_cortes':
        const recs = Array.isArray(userData.recommendations) ? userData.recommendations : [];
        if (recs.length > 0) {
          const top3 = recs.slice(0, 3);
          const totalEco = top3.reduce((s, r) => s + (Number(r.economiaPotencial) || 0), 0);
          return {
            intent,
            text: `💡 **Oportunidades de Economia Identificadas:**\n\n` +
              `Identifiquei um potencial de economia de até **${fmtCurrency(totalEco)}/mês** com base nos seus gastos reais:\n\n` +
              top3.map((r, i) => `${i + 1}. **${r.titulo}** (${r.categoria || 'Geral'})\n   Economia estimada: **${fmtCurrency(r.economiaPotencial)}/mês**\n   👉 *Ação:* ${r.acaoRecomendada || 'Ajustar categoria'}`).join('\n\n') +
              `\n\nSelecione as ações no painel de **Recomendações** acima para incluí-las nas suas metas.`,
            chips: [
              { label: '📊 Ver todos os gastos', query: 'Analisar meus gastos' },
              { label: '🎯 Ver minhas metas', query: 'Ver minhas metas' }
            ]
          };
        }
        if (totalDespesas === 0) {
          return {
            intent,
            text: 'Você não tem despesas cadastradas no momento. Cadastre seus lançamentos para que eu possa identificar onde economizar.',
            action: { section: 'despesas', label: 'Nova Despesa' }
          };
        }
        return {
          intent,
          text: `🎉 Seus gastos estão equilibrados no período selecionado (${periodLabel}).\n\nNenhuma despesa discricionária com desvio expressivo foi detectada no momento!`,
          chips: [
            { label: '📈 Ver investimentos', query: 'Avaliar meus investimentos' },
            { label: '🎯 Metas de poupança', query: 'Ver minhas metas' }
          ]
        };

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
          text: `🏷️ **Gastos com ${targetCategory.toUpperCase()} (${periodLabel}):**\n\n` +
            `• **Total gasto:** ${fmtCurrency(catTotal)}\n` +
            `• **Lançamentos:** ${filteredDespesas.length} item(ns)\n` +
            `• **Impacto nas despesas totais:** ${catPct.toFixed(1)}%\n\n` +
            (filteredDespesas.length > 0
              ? 'Consulte os lançamentos detalhados na aba **Despesas** para ver cada comprovante.'
              : 'Nenhum lançamento identificado para esta categoria no período ativo.'),
          chips: [
            { label: '💡 Onde economizar?', query: 'Como posso economizar?' },
            { label: '📊 Outras categorias', query: 'Analisar meus gastos' }
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
          text: `📈 **Diagnóstico da Carteira de Investimentos:**\n\n` +
            `• **Patrimônio Investido:** ${fmtCurrency(totalInvestido)}\n` +
            `• **Total Aplicado:** ${fmtCurrency(totalAplicado)}\n` +
            `• **Resultado Acumulado:** ${lucro >= 0 ? '+' : '−'} ${fmtCurrency(Math.abs(lucro))} (${rentabilidade.toFixed(2)}%)\n` +
            `• **Ativos Registrados:** ${investimentos.length} posição(ões)\n\n` +
            `💡 *Recomendação:* Mantenha sua carteira diversificada e revise seus aportes periodicamente.`,
          chips: [
            { label: '🎯 Metas de patrimônio', query: 'Ver minhas metas' },
            { label: '📄 Relatório completo', query: 'Gerar relatório em PDF' }
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
          text: `🎯 **Progresso das Metas Financeiras:**\n\n` +
            `• **Metas ativas:** ${metas.length} objetivo(s)\n` +
            `• **Valor acumulado:** ${fmtCurrency(totalAtualMetas)} de ${fmtCurrency(totalAlvo)}\n` +
            `• **Progresso consolidado:** ${progressoGeral.toFixed(1)}%\n\n` +
            `Continue direcionando seu saldo livre para concluir suas metas mais prioritárias.`,
          chips: [
            { label: '💡 Onde economizar?', query: 'Como posso economizar?' },
            { label: '💰 Ver saldo', query: 'Qual é o meu saldo?' }
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
            { label: '📉 Analisar gastos', query: 'Analisar meus gastos' },
            { label: '💰 Ver saldo', query: 'Qual é o meu saldo?' }
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
            { label: '📊 Analisar gastos', query: 'Analisar meus gastos' },
            { label: '📄 Gerar PDF', query: 'Gerar relatório em PDF' }
          ]
        };

      case 'relatorio_pdf':
        return {
          intent,
          text: '📄 Preparando o seu **relatório executivo em PDF** com os dados financeiros do período selecionado...',
          action: { type: 'generate_pdf' }
        };

      case 'vazio':
        return {
          intent,
          text: 'Digite uma pergunta ou escolha uma das opções rápidas abaixo para conversarmos sobre suas finanças.',
          chips: [
            { label: '📊 Analisar gastos', query: 'Analisar meus gastos' },
            { label: '💡 Onde economizar?', query: 'Como posso economizar?' },
            { label: '💰 Qual é o meu saldo?', query: 'Qual é o meu saldo?' }
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
