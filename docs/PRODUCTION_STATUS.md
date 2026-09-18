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
- teste de carga com 5.000 alunos e 600 requisições.

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

## Artefatos reprodutíveis

O `main` contém:

- `package-lock.json`;
- `prisma/migrations/migration_lock.toml`;
- migration baseline versionada.

## Pendências encontradas na revisão final

A validação técnica acima permanece válida, mas a revisão funcional do `main` encontrou dois pontos de produto que devem ser fechados antes de declarar go-live:

- `app/dashboard/page.tsx` ainda usa `@/lib/mock-data` para métricas, alunos recentes, atividade e resumo semanal;
- o bloco GUARDIAN de `/dashboard` ainda contém texto legado dizendo que o portal será conectado, embora `/portal/responsavel` já exista.

Esses itens não quebram build, migrations ou regressão de API, mas afetam a experiência e a veracidade dos dados exibidos na home autenticada.

Status correto: **release candidate pronto para homologação**, com go-live condicionado ao fechamento desses pontos e à validação da infraestrutura real.

Detalhes: `docs/KNOWN_GAPS.md`.

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
