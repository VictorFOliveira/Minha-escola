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
- restore drill automatizado;
- monitoramento de produção via GitHub Actions;
- CodeQL e dependency audit;
- regressão HTTP;
- teste de carga com 5.000 alunos e 600 requisições.

## Artefatos reprodutíveis

O `main` contém:

- `package-lock.json`;
- `prisma/migrations/migration_lock.toml`;
- migration baseline versionada.

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
