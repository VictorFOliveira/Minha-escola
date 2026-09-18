# Production Runbook — Minha Escola

## Objetivo

Checklist operacional para publicar o Minha Escola com dados reais.

## Pré-requisitos

- Node.js 22;
- PostgreSQL 16 ou compatível;
- domínio com HTTPS;
- secrets fora do repositório;
- storage S3-compatible privado;
- serviço de backup do banco;
- opcionalmente Asaas, Resend e Meta WhatsApp.

## Banco

Em produção use migrations versionadas:

```bash
npm ci
npm run db:generate
npm run db:migrate:deploy
```

Não use `prisma db push` como mecanismo de deploy de produção.

O readiness do banco pode ser verificado em:

```
GET /api/health/ready
```

## Deploy

A imagem pode ser criada com:

```bash
docker build -t minha-escola .
```

O processo deve receber as variáveis descritas em `.env.example`.

## Jobs

### Comunicação

Pode rodar de hora em hora:

```
POST /api/jobs/communications
Authorization: Bearer CRON_SECRET
```

### Manutenção diária

```
POST /api/jobs/daily
Authorization: Bearer CRON_SECRET
```

Executa:

- expiração de autorizações;
- fila de comunicação;
- avisos financeiros;
- cobrança do SaaS;
- suspensão por inadimplência após carência;
- limpeza de uploads abandonados;
- limpeza de throttles expirados;
- retenção de logs de auditoria.

O workflow `.github/workflows/scheduled-jobs.yml` pode chamar essas rotas quando `PRODUCTION_APP_URL` e `CRON_SECRET` forem configurados como GitHub Actions Secrets.

## Storage

O bucket deve ser privado.

O backend fornece URLs assinadas de curta duração para upload/download e mantém apenas a chave do objeto no banco.

Nunca torne o bucket público para simplificar anexos.

## Comunicação

### E-mail

Configure:

- `RESEND_API_KEY`;
- `EMAIL_FROM`;
- `APP_URL`.

Na escola, habilite o canal e configure o provider como `RESEND`.

### WhatsApp

Configure:

- `WHATSAPP_ACCESS_TOKEN`;
- `WHATSAPP_PHONE_NUMBER_ID`;
- `WHATSAPP_GRAPH_VERSION`;
- `WHATSAPP_TEMPLATE_NAME`;
- `WHATSAPP_TEMPLATE_LANGUAGE`.

Na escola, habilite o canal e configure o provider como `META_CLOUD`.

O template precisa estar aprovado pela conta Meta usada no deploy.

## Pagamentos

Existem duas integrações independentes:

1. Asaas de uma escola, usado nas mensalidades de alunos;
2. Asaas da plataforma, usado para cobrar a assinatura do Minha Escola.

Nunca compartilhe as chaves entre esses dois contextos por conveniência.

## Backup

Use backup gerenciado do provedor PostgreSQL como primeira camada.

O script `scripts/backup-postgres.sh` fornece uma segunda opção operacional usando `pg_dump`.

Teste a restauração regularmente com `scripts/restore-postgres.sh` em banco isolado.

Um backup que nunca foi restaurado em teste não deve ser considerado validado.

## Segurança

Antes de liberar uma escola:

- secrets com 32+ caracteres;
- HTTPS obrigatório;
- Superadmin separado;
- bucket privado;
- webhook tokens separados das API keys;
- rate limiting ativo;
- Postgres sem exposição pública desnecessária;
- usuário do banco com permissões mínimas para a aplicação;
- backups ativos;
- logs/alertas do provedor ativos.

## Rollback

Se uma versão nova falhar:

1. pare novas implantações;
2. não reverta migration destrutiva sem backup;
3. restaure a versão anterior da aplicação;
4. confira `prisma migrate status`;
5. valide `/api/health/ready`;
6. execute smoke tests;
7. só então reabra tráfego.

## Observabilidade mínima

No provedor escolhido configure alertas para:

- HTTP 5xx;
- readiness 503;
- uso de CPU/memória;
- conexões PostgreSQL;
- espaço do banco;
- falha de jobs agendados;
- falha de backups;
- aumento anormal de 401/429;
- webhook com erro recorrente.
