# Status de Produção

Atualizado em 18/09/2026.

## Fechado no código

- SaaS multi-tenant;
- autenticação e RBAC;
- MFA/TOTP para perfis críticos;
- sessões revogáveis;
- alunos, responsáveis, professores, funcionários e turmas;
- matrícula/rematrícula;
- acadêmico, diário, frequência, avaliações, notas e boletim;
- financeiro, pagamentos e Asaas opcional;
- comunicação Portal/e-mail/WhatsApp;
- documentos e PDF server-side;
- LGPD, consentimento, exportação e anonimização controlada;
- API v1 e webhooks assinados;
- idempotência em operações críticas;
- storage privado e malware scan fail-closed em produção;
- rate limiting persistente;
- paginação e limites em listas grandes;
- Docker e migrations;
- health/readiness/health operacional;
- backup/restore scripts;
- restore drill automatizado e validado;
- monitoramento de produção via GitHub Actions;
- CodeQL e dependency audit;
- regressão HTTP;
- teste de carga com 5.000 alunos e 600 requisições;
- regressão destrutiva concorrente com 3.000 requisições e páginas SSR.

## Validação final

Em 18/09/2026 foram observados verdes:

- Prisma validate/generate;
- migration deploy em PostgreSQL vazio;
- testes unitários e integração multi-tenant;
- gate de performance;
- TypeScript;
- Next.js build production;
- regressão HTTP com aplicação compilada;
- migration status;
- dependency audit em nível moderate+;
- CodeQL;
- Dockerfile de produção;
- docker-compose de produção;
- Caddyfile;
- teste de carga de 600 requisições;
- backup + restore drill real em segundo banco.

Na última rodada de carga: **600 requisições, 0 falhas**, p95 sustentado de aproximadamente **275 ms** e p95 da rajada de 100 concorrentes de aproximadamente **482 ms**.

## Regressão destrutiva final

Em 18/09/2026 foi concluída uma rodada adicional de abuso concorrente:

- 5.000 alunos e 3.000 cobranças;
- 44 usuários concorrentes;
- 2.000 requests com concorrência 100;
- rajada de 1.000 requests com concorrência 250;
- dashboard SSR, Portal do Aluno e Portal do Responsável no mix;
- 3.000/3.000 respostas com sucesso;
- 0 falhas e 0% de erro;
- p95 sustentado de 491 ms;
- p95 da rajada de 1.303 ms;
- readiness e migration status verdes após a carga;
- log final sem erro Prisma/P20xx, timeout, deadlock ou falha de integridade.

A rodada também encontrou e corrigiu condições de corrida em idempotência, rate limit, matrícula, capacidade de turma, pagamentos e webhooks, além de endurecer callbacks de malware.

Detalhes: `docs/DESTRUCTIVE_REGRESSION.md`.

## Artefatos reprodutíveis

O `main` contém:

- `package-lock.json`;
- `prisma/migrations/migration_lock.toml`;
- migration baseline versionada.

## Revisão funcional final

Em 18/09/2026, a última pendência funcional conhecida do dashboard foi fechada:

- métricas da home passaram a consultar PostgreSQL por tenant;
- aluno ativo, turmas, frequência e financeiro deixaram de usar valores sintéticos;
- professor recebe somente dados das turmas/disciplinas vinculadas;
- alunos e responsáveis são redirecionados aos portais próprios;
- `lib/mock-data.ts` foi removido;
- landing page foi alinhada ao estado atual das 11 fases.

Com isso, não há bloqueador funcional conhecido no código para iniciar a homologação final.

## Dependências externas ainda necessárias para um go-live real

Esses itens não podem ser provisionados apenas pelo repositório:

- VPS ou plataforma de containers;
- domínio e DNS;
- credenciais do banco gerenciado, se usado;
- bucket S3/R2 e scanner de malware;
- Resend;
- Meta WhatsApp;
- Asaas, quando ativado;
- Sentry, quando ativado;
- GitHub Secrets de produção.

Os arquivos e runbooks para configurar esses serviços estão no repositório; a criação das contas/credenciais permanece uma etapa operacional do ambiente.
