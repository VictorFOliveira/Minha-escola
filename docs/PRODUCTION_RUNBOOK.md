# Production Runbook — Minha Escola

## Objetivo

Operar o Minha Escola com dados reais usando migrations versionadas, HTTPS, health checks, backups e rollback controlado.

## Pré-requisitos

- Node.js 22 para execução sem Docker;
- Docker + Docker Compose para o fluxo recomendado em VPS;
- PostgreSQL 16 ou compatível;
- domínio/DNS;
- secrets fora do repositório;
- storage S3-compatible privado;
- scanner de malware;
- serviço de backup do banco;
- opcionalmente Sentry, Asaas, Resend e Meta WhatsApp.

## Artefatos de release

O `main` deve conter:

- `package-lock.json`;
- `prisma/migrations/migration_lock.toml`;
- `prisma/migrations/00000000000000_baseline/migration.sql`.

Instalação de produção usa `npm ci`.

## Banco

Em produção:

~~~bash
npm ci
npm run db:generate
npm run db:migrate:deploy
~~~

Nunca use `prisma db push` como mecanismo de deploy.

## VPS

Arquivos:

- `docker-compose.production.yml`;
- `ops/Caddyfile`;
- `.env.production.example`;
- `scripts/deploy-production.sh`.

Guia completo: `docs/VPS_DEPLOYMENT.md`.

O compose não publica PostgreSQL na internet. Caddy expõe apenas HTTP/HTTPS e obtém TLS automaticamente quando DNS e domínio estão corretos.

## Deploy

~~~bash
cp .env.production.example .env.production
# preencher secrets
bash scripts/deploy-production.sh
~~~

O deploy executa migration antes de substituir/levantar o serviço web e só encerra com sucesso depois de readiness verde.

## Health

Públicos:

- `GET /api/health`;
- `GET /api/health/ready`.

Protegido:

~~~text
GET /api/health/ops
Authorization: Bearer CRON_SECRET
~~~

O endpoint operacional não retorna segredos. Ele informa versão, status do banco, conexões, jobs recentes, falhas nas últimas 24h, uploads pendentes e presença/ausência das integrações.

## Monitoramento

`.github/workflows/production-health.yml` verifica a produção a cada 15 minutos quando os seguintes secrets estiverem configurados:

- `PRODUCTION_APP_URL`;
- `CRON_SECRET`.

Falha de readiness, banco ou job recente faz o workflow falhar e ficar visível no GitHub Actions.

Sentry é opcional e ativado por:

- `SENTRY_DSN`;
- `SENTRY_ENVIRONMENT`;
- `SENTRY_TRACES_SAMPLE_RATE`.

## Jobs

### Comunicação

~~~text
POST /api/jobs/communications
Authorization: Bearer CRON_SECRET
~~~

Processa fila de comunicação e webhooks de saída.

### Manutenção diária

~~~text
POST /api/jobs/daily
Authorization: Bearer CRON_SECRET
~~~

Executa:

- expiração de autorizações;
- fila de comunicação;
- avisos financeiros;
- cobrança do SaaS;
- suspensão por inadimplência após carência;
- limpeza de uploads abandonados;
- limpeza de throttles;
- limpeza de idempotências expiradas;
- limpeza de tokens de reset expirados;
- retenção de auditoria.

O workflow `scheduled-jobs.yml` chama essas rotas.

## Storage/upload

- bucket sempre privado;
- URLs assinadas curtas;
- HTML/SVG fora da allowlist;
- limite de tamanho no backend;
- em produção o malware scan é obrigatório por padrão;
- arquivo pendente não fica disponível;
- resultado infectado remove o objeto.

## Comunicação

### E-mail

- `RESEND_API_KEY`;
- `EMAIL_FROM`;
- `APP_URL`.

### WhatsApp

- `WHATSAPP_ACCESS_TOKEN`;
- `WHATSAPP_PHONE_NUMBER_ID`;
- `WHATSAPP_GRAPH_VERSION`;
- `WHATSAPP_TEMPLATE_NAME`;
- `WHATSAPP_TEMPLATE_LANGUAGE`.

Templates precisam estar aprovados na Meta.

## Pagamentos

Há duas contas independentes:

1. Asaas da escola, para mensalidades;
2. Asaas da plataforma, para assinatura do SaaS.

Nunca reutilize a mesma chave por conveniência.

## Backup

Backup/PITR do provedor é a primeira camada recomendada.

Segunda camada:

~~~bash
bash scripts/backup-postgres.sh
~~~

Restauração exige confirmação explícita:

~~~bash
ALLOW_DATABASE_RESTORE=YES_I_KNOW \
  bash scripts/restore-postgres.sh backup.dump
~~~

`.github/workflows/restore-drill.yml` testa mensalmente backup + restauração em banco isolado e verifica também o histórico de migrations.

## Segurança mínima

- secrets independentes com 32+ caracteres;
- MFA para ADMIN/Superadmin;
- HTTPS;
- bucket privado;
- scanner ativo;
- Postgres não exposto publicamente;
- usuário do banco com menor privilégio operacional possível;
- backups ativos;
- logs/alertas;
- dependency audit e CodeQL verdes.

## Performance

Resultado de referência em `docs/LOAD_TEST_RESULTS_600.md`:

- 5.000 alunos;
- 3.000 cobranças;
- 600 requisições;
- 100 concorrentes na rajada;
- 0 falhas nesse ambiente de CI.

Isso não substitui teste na VPS escolhida.

## Rollback

1. interrompa novos deploys;
2. mantenha banco/migrations intactos até entender o incidente;
3. volte aplicação para commit/imagem anterior compatível;
4. execute `prisma migrate status`;
5. valide `/api/health/ready`;
6. execute `scripts/smoke-production.sh`;
7. restaure banco somente se a recuperação realmente exigir e houver backup validado.
