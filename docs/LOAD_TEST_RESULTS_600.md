# Load Test — 5.000 alunos / 600 requisições

Data: 2026-09-18

## Ambiente

- Next.js 15.5.25 compilado em modo production;
- PostgreSQL 16;
- 5.000 alunos;
- 3.000 cobranças;
- 39 usuários autenticados:
  - 20 alunos;
  - 10 professores;
  - 3 coordenadores;
  - 3 usuários de secretaria;
  - 3 usuários do financeiro.

## Fase 1 — carga sustentada

- 400 requisições;
- concorrência: 40;
- sucesso: 400;
- falhas: 0;
- taxa de erro: 0%;
- throughput: 211,21 req/s;
- p50: 159,34 ms;
- p95: 314,08 ms;
- p99: 880,34 ms;
- máximo: 949,27 ms.

Distribuição por perfil:

- aluno: 210;
- professor: 100;
- coordenador: 30;
- secretaria: 30;
- financeiro: 30.

## Fase 2 — rajada

- 200 requisições;
- concorrência: 100;
- sucesso: 200;
- falhas: 0;
- taxa de erro: 0%;
- throughput: 243,97 req/s;
- p50: 348,06 ms;
- p95: 749,11 ms;
- p99: 787,13 ms;
- máximo: 788,62 ms.

Distribuição por perfil:

- aluno: 105;
- professor: 50;
- coordenador: 15;
- secretaria: 15;
- financeiro: 15.

## Total

- 600 requisições;
- 600 respostas HTTP 200;
- 0 falhas;
- 0 timeouts;
- 0 respostas 429;
- 0 respostas 5xx.

Endpoints exercitados incluíram:

- autenticação/sessão;
- caixa de comunicação;
- documentos do aluno;
- turmas;
- matrículas;
- alunos paginados;
- professores paginados;
- resumo financeiro;
- cobranças;
- contratos financeiros;
- planos financeiros.

## Gate

O teste falha automaticamente caso:

- exista qualquer resposta inesperada;
- p95 sustentado ultrapasse 1.500 ms;
- p95 da rajada ultrapasse 2.500 ms.

Resultado: **PASSOU**.

Este teste demonstra boa resposta neste cenário de referência, mas não substitui dimensionamento do ambiente de produção. Banco, CPU, memória, latência de rede e integrações externas influenciam a capacidade real.
