# Regressão destrutiva — Minha Escola

Atualizado em 18/09/2026.

## Objetivo

Forçar condições que normalmente só aparecem sob concorrência, repetição de callbacks e volume elevado, sem aceitar corrupção silenciosa de dados.

## Cenários cobertos

- rajada concorrente de tentativas de login e rate limit;
- 20 criações simultâneas com a mesma `Idempotency-Key`;
- chave idempotente inválida/grande;
- matrícula simultânea com a mesma chave;
- duas matrículas simultâneas do mesmo aluno em turmas diferentes do mesmo ano;
- duas matrículas simultâneas disputando a última vaga de uma turma;
- geração simultânea de mensalidades;
- pagamento simultâneo com a mesma chave;
- dois pagamentos integrais com chaves diferentes disputando a mesma cobrança;
- callbacks Asaas duplicados em paralelo;
- callbacks Asaas fora de ordem após pagamento/estorno;
- callbacks do scanner de malware fora de ordem;
- tentativa de vazamento cross-tenant no dashboard;
- sessão revogada reutilizada;
- JSON e datas inválidas;
- paginação abusiva;
- acessos proibidos em rajada;
- SSR do dashboard;
- Portal do Aluno;
- Portal do Responsável;
- tráfego misto por perfis;
- readiness após abuso.

## Falhas encontradas e corrigidas

Durante esta rodada foram encontrados e corrigidos:

1. corrida na reserva de idempotência;
2. perda potencial de incremento no rate limit concorrente;
3. pagamento manual duplo sob concorrência;
4. geração concorrente de mensalidades;
5. conflito simultâneo de matrícula;
6. disputa de capacidade de turma;
7. duas matrículas do mesmo aluno no mesmo ano;
8. datas inválidas que poderiam chegar ao ORM;
9. callback de malware fora de ordem;
10. webhook Asaas duplicado/fora de ordem;
11. retorno `void` de advisory lock incompatível com desserialização do Prisma;
12. asserção antiga do próprio teste de dashboard, que assumia um aluno fixo no top 4 e foi corrigida para validar o registro real mais recente do tenant.

## Primeira rodada pesada

A primeira execução destrutiva concluída utilizou:

- 5.000 alunos;
- 3.000 cobranças;
- 2.000 requisições sustentadas com concorrência 100;
- 1.000 requisições em rajada com concorrência 250;
- total: 3.000 requisições.

Resultado:

- falhas: **0**;
- taxa de erro: **0%**;
- sustentado p95: **528 ms**;
- sustentado p99: **595 ms**;
- rajada p95: **1.140 ms**;
- rajada p99: **1.193 ms**;
- throughput observado: ~261 req/s sustentado e ~290 req/s na rajada.

## Passe final

O passe final repete os 3.000 requests e acrescenta os cenários de matrícula, malware, webhooks e páginas SSR/portais incorporados depois da primeira rodada.

O resultado final deve ser registrado aqui somente depois que todos os gates terminarem verdes.
