'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const enginePath = path.resolve(__dirname, '../js/prisma-ai-engine.js');
const PrismaAiEngine = require(enginePath);

test('Prisma AI Engine — Normalização e Tokenização', () => {
  assert.equal(PrismaAiEngine.normalizeText('Olá, Mundo!'), 'ola mundo');
  assert.equal(PrismaAiEngine.normalizeText('COMO ECONOMIZAR NOS GASTOS???'), 'como economizar nos gastos');
  assert.equal(PrismaAiEngine.normalizeText('Relatório Financeiro & PDF.'), 'relatorio financeiro pdf');
  assert.deepEqual(PrismaAiEngine.tokenize('  Analisar   despesas  de  viagem!  '), ['analisar', 'despesas', 'de', 'viagem']);
});

test('Prisma AI Engine — Suíte de ≥ 40 Frases Reais de Usuários', () => {
  const testCases = [
    // 1-5: Saudações (com e sem acento, variações)
    { query: 'Olá!', expectedIntent: 'saudacao' },
    { query: 'ola', expectedIntent: 'saudacao' },
    { query: 'bom dia Prisma', expectedIntent: 'saudacao' },
    { query: 'boa tarde', expectedIntent: 'saudacao' },
    { query: 'opa tudo bem', expectedIntent: 'saudacao' },

    // 6-10: Agradecimentos
    { query: 'Muito obrigado pela ajuda!', expectedIntent: 'agradecimento' },
    { query: 'obrigada!', expectedIntent: 'agradecimento' },
    { query: 'valeu demais', expectedIntent: 'agradecimento' },
    { query: 'show de bola', expectedIntent: 'agradecimento' },
    { query: 'otimo servico', expectedIntent: 'agradecimento' },

    // 11-15: Ajuda e Capacidades
    { query: 'O que você faz?', expectedIntent: 'ajuda' },
    { query: 'o que voce faz', expectedIntent: 'ajuda' },
    { query: 'preciso de ajuda', expectedIntent: 'ajuda' },
    { query: 'como funciona o assistente?', expectedIntent: 'ajuda' },
    { query: 'quais as opcoes do menu?', expectedIntent: 'ajuda' },

    // 16-20: Saldo e Contas
    { query: 'Qual é o meu saldo atual?', expectedIntent: 'saldo' },
    { query: 'qual o meu saldo', expectedIntent: 'saldo' },
    { query: 'quanto dinheiro eu tenho?', expectedIntent: 'saldo' },
    { query: 'saldo em conta', expectedIntent: 'saldo' },
    { query: 'quanto sobrou na minha conta?', expectedIntent: 'saldo' },

    // 21-25: Receitas e Rendimentos
    { query: 'Quanto eu ganhei este mês?', expectedIntent: 'receitas' },
    { query: 'minhas receitas do mes', expectedIntent: 'receitas' },
    { query: 'qual foi meu salario?', expectedIntent: 'receitas' },
    { query: 'total de entradas', expectedIntent: 'receitas' },
    { query: 'mostrar faturamento', expectedIntent: 'receitas' },

    // 26-30: Análise de Gastos e Despesas
    { query: 'Analisar meus gastos', expectedIntent: 'analise_gastos' },
    { query: 'analise de gastos', expectedIntent: 'analise_gastos' },
    { query: 'fazer diagnostico financeiro', expectedIntent: 'analise_gastos' },
    { query: 'como estao minhas despesas?', expectedIntent: 'analise_gastos' },
    { query: 'raio x financeiro', expectedIntent: 'analise_gastos' },

    // 31-35: Economia e Cortes (Desambiguação)
    { query: 'Como posso economizar?', expectedIntent: 'economia_cortes' },
    { query: 'onde posso economizar dinheiro?', expectedIntent: 'economia_cortes' },
    { query: 'como economizar nos gastos?', expectedIntent: 'economia_cortes' }, // desambiguação gastos vs economia
    { query: 'onde cortar despesas?', expectedIntent: 'economia_cortes' },
    { query: 'dicas para poupar mais', expectedIntent: 'economia_cortes' },

    // 36-40: Categorias Específicas de Gastos
    { query: 'Quanto gastei com alimentação este mês?', expectedIntent: 'categoria_gastos' },
    { query: 'gastos com supermercado e compras', expectedIntent: 'categoria_gastos' },
    { query: 'quanto custou o aluguel e moradia?', expectedIntent: 'categoria_gastos' },
    { query: 'gastos com gasolina e transporte', expectedIntent: 'categoria_gastos' },
    { query: 'quanto gastei com farmacia e saude?', expectedIntent: 'categoria_gastos' },

    // 41-45: Investimentos e Carteira
    { query: 'Como estão meus investimentos?', expectedIntent: 'investimentos' },
    { query: 'avaliar minha carteira de ativos', expectedIntent: 'investimentos' },
    { query: 'quanto rendeu minha carteira?', expectedIntent: 'investimentos' },
    { query: 'meu patrimonio liquido total', expectedIntent: 'investimentos' },
    { query: 'como esta a renda fixa?', expectedIntent: 'investimentos' },

    // 46-50: Metas e Planejamento
    { query: 'Ver minhas metas financeiras', expectedIntent: 'metas' },
    { query: 'como estao meus objetivos?', expectedIntent: 'metas' },
    { query: 'planejar reserva de emergencia', expectedIntent: 'metas' },
    { query: 'meu plano financeiro', expectedIntent: 'metas' },
    { query: 'criar meta de economia', expectedIntent: 'metas' },

    // 51-54: Cartões e Dívidas
    { query: 'Qual o limite do meu cartão de crédito?', expectedIntent: 'cartoes' },
    { query: 'fatura do cartao', expectedIntent: 'cartoes' },
    { query: 'minhas dividas em aberto', expectedIntent: 'cartoes' },
    { query: 'limite de credito disponivel', expectedIntent: 'cartoes' },

    // 55-57: Relatório em PDF com Ação Expressa
    { query: 'Gerar relatório em PDF', expectedIntent: 'relatorio_pdf' },
    { query: 'baixar relatorio pdf', expectedIntent: 'relatorio_pdf' },
    { query: 'exportar meu pdf', expectedIntent: 'relatorio_pdf' },

    // 58-60: Comparar Períodos
    { query: 'Comparar com o mês passado', expectedIntent: 'comparar_periodos' },
    { query: 'comparativo mensal', expectedIntent: 'comparar_periodos' },
    { query: 'evolucao das despesas', expectedIntent: 'comparar_periodos' }
  ];

  for (const tc of testCases) {
    const res = PrismaAiEngine.classifyIntent(tc.query);
    assert.equal(
      res.intent,
      tc.expectedIntent,
      `Frase: "${tc.query}" deveria ser classificada como "${tc.expectedIntent}", mas resultou em "${res.intent}"`
    );
  }
});

test('Prisma AI Engine — Casos Extremos e Proteções Contra Falsos Positivos', () => {
  // 1. "onde" dentro de "responde" NÃO pode virar economia_cortes
  const c1 = PrismaAiEngine.classifyIntent('Ele respondeu a pergunta');
  assert.notEqual(c1.intent, 'economia_cortes', 'respondeu não deve disparar economia');

  // 2. "meta" dentro de "metade" NÃO pode virar metas
  const c2 = PrismaAiEngine.classifyIntent('Gastei a metade do valor');
  assert.notEqual(c2.intent, 'metas', 'metade não deve disparar metas');

  // 3. Menção casual a PDF NÃO pode disparar geração de PDF
  const c3 = PrismaAiEngine.classifyIntent('O que tem dentro do arquivo PDF?');
  assert.notEqual(c3.intent, 'relatorio_pdf', 'Menção informativa a PDF não deve exportar documento');

  const c4 = PrismaAiEngine.classifyIntent('Não quero gerar nenhum PDF');
  assert.notEqual(c4.intent, 'relatorio_pdf', 'Negação de PDF não deve exportar');

  // 4. Mensagens vazias ou só espaços
  assert.equal(PrismaAiEngine.classifyIntent('').intent, 'vazio');
  assert.equal(PrismaAiEngine.classifyIntent('   ').intent, 'vazio');
  assert.equal(PrismaAiEngine.classifyIntent(null).intent, 'vazio');

  // 5. Mensagens sem sentido financeiro caem em Fallback honesto
  const fb = PrismaAiEngine.classifyIntent('Gostaria de comprar um disco voador em Júpiter');
  assert.equal(fb.intent, 'fallback');

  // 6. Mensagens excessivamente longas são processadas sem travar
  const longText = 'Olá Prisma ' + 'gastos despesas receitas '.repeat(200);
  const cLong = PrismaAiEngine.classifyIntent(longText);
  assert.ok(cLong.intent);
});

test('Prisma AI Engine — Geração de Respostas com Dados Reais e Ausência de Dados', () => {
  // Cenário 1: Sem dados cadastrados
  const ansNoData = PrismaAiEngine.generateAnswer('Qual é o meu saldo?', { contas: [], receitas: [] });
  assert.match(ansNoData.text, /Você ainda não cadastrou nenhuma conta bancária/);
  assert.equal(ansNoData.action.section, 'contas');

  // Cenário 2: Com dados reais cadastrados
  const mockUserData = {
    contas: [{ id: 'c1', nome: 'Nubank', saldo: 2500.50 }],
    receitas: [{ id: 'r1', valor: 6000.00, data: '2026-11-05' }],
    despesas: [
      { id: 'd1', descricao: 'Aluguel', categoria: 'moradia', valor: 2000.00 },
      { id: 'd2', descricao: 'Supermercado', categoria: 'alimentacao', valor: 1200.00 }
    ],
    goals: [{ id: 'g1', nome: 'Reserva', alvo: 10000, atual: 4000 }],
    investimentos: [{ id: 'i1', nome: 'CDB', valorAtual: 5500, valorAplicado: 5000 }],
    periodLabel: 'em Novembro/2026'
  };

  const ansSaldo = PrismaAiEngine.generateAnswer('Qual é o meu saldo?', mockUserData);
  assert.match(ansSaldo.text, /R\$\s*2\.500,50/);
  assert.match(ansSaldo.text, /R\$\s*2\.800,00/); // 6000 - 3200 = 2800

  const ansCat = PrismaAiEngine.generateAnswer('Quanto gastei com alimentacao?', mockUserData);
  assert.match(ansCat.text, /R\$\s*1\.200,00/);

  const ansInvest = PrismaAiEngine.generateAnswer('Avaliar meus investimentos', mockUserData);
  assert.match(ansInvest.text, /R\$\s*5\.500,00/);
  assert.match(ansInvest.text, /\+ R\$\s*500,00/);
});
