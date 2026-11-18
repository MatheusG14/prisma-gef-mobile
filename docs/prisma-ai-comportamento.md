# Especificação Comportamental do Prisma AI

**Módulo:** `js/prisma-ai-engine.js`  
**Objetivo:** Motor de intenções determinístico, com pontuação de confiança, normalização fonética/NFD e respostas financeiras amparadas exclusivamente nos dados reais do usuário.

---

## 1. Princípios de Resposta e Segurança

1. **Uso Exclusivo de Dados Reais:** O assistente nunca inventa valores ou assume dados fictícios. Se o usuário não tiver receitas, despesas, contas ou metas, a IA declara a ausência do dado e fornece uma ação direta para a respectiva seção de cadastro.
2. **Consistência Numérica:** Todos os totais (receitas, despesas, taxa de poupança, patrimônio) utilizam as mesmas funções matemáticas puras de consolidação do Dashboard e Relatórios, com arredondamento estrito no final (`R$ 0,00` e `%` com uma casa decimal).
3. **Proteção Contra Falsos Positivos:** O reconhecimento de intenções baseia-se em tokenização por palavras inteiras e correspondência semântica ponderada. A palavra "onde" não dispara economia se inserida em "responde"; "meta" não casa em "metade".
4. **Relatório em PDF com Ação Expressa:** Menções casuais a "PDF" (ex.: *"o que é PDF?"*, *"não quero PDF"*) não disparam download involuntário. A geração exige expressamente um verbo de ação (ex.: *"gerar PDF"*, *"baixar relatório"*).
5. **Privacidade e LGPD:** Na ausência de consentimento para análise preditiva e personalização, o Prisma AI atua em modo estritamente descritivo/local e não sincroniza análises em segundo plano com `/api/prisma-ai/analysis`.

---

## 2. Matriz de Intenções e Comportamento Esperado

| Pergunta de Exemplo | Intenção Classificada | Resposta Esperada / Ação |
| :--- | :--- | :--- |
| *"Olá, bom dia!"* | `saudacao` | Saudação acolhedora e apresentação dos 3 principais recursos como chips. |
| *"Muito obrigado pela ajuda"* | `agradecimento` | Agradecimento amigável mantendo a prontidão para novas consultas. |
| *"O que você faz?"* | `ajuda` | Lista com bullets das capacidades (analisar gastos, economia, saldo, investimentos, PDF). |
| *"Qual é o meu saldo atual?"* | `saldo` | Valor consolidado das contas registradas (`R$ X`), resultado do fluxo do mês e status positivo/negativo. |
| *"Quanto eu ganhei este mês?"* | `receitas` | Total de receitas do período ativo em `R$`, número de lançamentos e média por entrada. |
| *"Analisar meus gastos"* | `analise_gastos` | Diagnóstico com total de despesas, fluxo líquido e cálculo exato da taxa de poupança (`%`). |
| *"Como posso economizar?"* | `economia_cortes` | Top 3 oportunidades de economia fundamentadas nos dados reais, sem atingir custos essenciais. |
| *"Quanto gastei com alimentação?"* | `categoria_gastos` | Filtro dinâmico da categoria 'alimentação': total gasto (`R$`), contagem e % do orçamento. |
| *"Quanto gastei com transporte e uber?"* | `categoria_gastos` | Total gasto com transporte/combustível no período ativo. |
| *"Como estão meus investimentos?"* | `investimentos` | Patrimônio aplicado, valor atual, rendimento absoluto (`+ R$`) e percentual de retorno (`%`). |
| *"Ver minhas metas financeiras"* | `metas` | Quantidade de metas ativas, valor acumulado vs objetivo total e percentual consolidado. |
| *"Qual é a fatura do meu cartão?"* | `cartoes` | Limite total cadastrado e situação dos cartões de crédito. |
| *"Comparar com o mês passado"* | `comparar_periodos` | Comparativo de evolução e instrução para alternar os filtros de período do topo. |
| *"Gerar relatório em PDF"* | `relatorio_pdf` | Disparo seguro da função executiva de exportação de PDF. |
| *"O que tem no PDF?"* | `fallback` / `ajuda` | **Não dispara** download; explica o conteúdo do relatório executivo. |
| *"Quero comprar um foguete para Marte"* | `fallback` | Admissão educada de dúvida e 3 chips tocáveis para orientar o usuário. |
| *"" (mensagem vazia)* | `vazio` | Orientação para selecionar uma opção rápida ou digitar. |

---

## 3. Gestão de Fila e UX Mobile

- **Fila de Mensagens:** Mensagens enviadas em rápida sucessão são enfileiradas sequencialmente (`_messageQueue`), impedindo respostas fora de ordem ou race conditions.
- **Botão Enviar:** É desabilitado (`disabled = true`) durante a computação da resposta e reabilitado imediatamente após a renderização.
- **Entrada no Teclado Móvel:** O chat responde ao evento `keydown` (respeitando `event.isComposing` para compatibilidade total com teclados SwiftKey, Gboard e iOS IME).
- **Auto-Scroll Inteligente:** A rolagem do chat para a nova mensagem só ocorre se o usuário já estiver próximo ao final do histórico, preservando a leitura de mensagens anteriores.
- **Limpeza Segura de Histórico:** O botão de reset do chat solicita confirmação via diálogo acessível antes de apagar as mensagens.
