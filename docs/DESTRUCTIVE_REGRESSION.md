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
12. asserção antiga do próprio teste de dashboard, que assumia um aluno fixo no top 4 e foi corrigida para validar o registro real mais recente do tenant;
13. cleanup do banco descartável do teste tentava apagar entidades auditáveis protegidas por `RESTRICT`; o cleanup foi ajustado para não gerar erro falso no log.

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

## Passe final — aprovado

Execução final: GitHub Actions `Destructive regression`, run **35397427671**, em 18/09/2026.

Fixture:

- **5.000 alunos**;
- **3.000 cobranças**;
- **44 usuários concorrentes**, incluindo aluno, responsável, professor, coordenação, secretaria e financeiro;
- dashboard SSR, Portal do Aluno e Portal do Responsável incluídos no tráfego.

Carga:

- sustentado: **2.000 requests**, concorrência **100**;
- rajada: **1.000 requests**, concorrência **250**;
- total: **3.000 requests**.

Resultado final:

- respostas bem-sucedidas: **3.000 / 3.000**;
- falhas: **0**;
- taxa de erro: **0%**;
- sustentado: ~**217 req/s**, p50 **214 ms**, p95 **491 ms**, p99 **790 ms**;
- rajada: ~**256 req/s**, p50 **667 ms**, p95 **1.303 ms**, p99 **2.107 ms**;
- regressão HTTP destrutiva: **OK**;
- readiness após abuso: **ready / database ok**;
- migrations após abuso: **OK**;
- varredura final do log por `prisma:error`, `P20xx`, timeout, deadlock, erro de FK e conexão: **nenhuma ocorrência**.

## Interpretação

O cenário extremo de 250 requisições concorrentes elevou a latência de cauda, como esperado em runner compartilhado de CI, mas não provocou erro HTTP, timeout, corrupção observável ou perda de integridade.

Esse resultado passa a ser o baseline destrutivo de CI. Ele não substitui o teste final na VPS/infraestrutura contratada, onde CPU, RAM, I/O, rede e PostgreSQL serão diferentes.
