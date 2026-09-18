# Deploy em VPS — Minha Escola

## Objetivo

Executar o Minha Escola em uma VPS com HTTPS automático, migrations versionadas, health checks e rollback simples.

## Capacidade de referência

O repositório possui um teste de carga registrado em `docs/LOAD_TEST_RESULTS_600.md` com:

- 5.000 alunos;
- 3.000 cobranças;
- 39 usuários autenticados;
- 600 requisições HTTP;
- rajada de 100 requisições concorrentes;
- 0 erros no cenário testado.

Esse benchmark foi executado em runner de CI, não na VPS final. CPU, RAM, disco, latência e banco alteram a capacidade real.

Como referência operacional inicial:

- 2 vCPU / 4 GB RAM: ambiente pequeno ou homologação;
- 4 vCPU / 8 GB RAM: ponto inicial recomendado quando aplicação e PostgreSQL dividem a VPS;
- banco gerenciado separado: preferível para produção, principalmente por backup, I/O e isolamento.

## Portas

Exponha somente:

- TCP 22: SSH, preferencialmente restrito por IP;
- TCP 80: redirecionamento/ACME;
- TCP/UDP 443: HTTPS/HTTP3.

Não publique a porta 5432 do PostgreSQL na internet.

## Arquivos

- `docker-compose.production.yml`;
- `ops/Caddyfile`;
- `.env.production.example`;
- `scripts/deploy-production.sh`;
- `scripts/smoke-production.sh`.

## Preparação

~~~bash
git clone <repositorio>
cd Minha-escola
cp .env.production.example .env.production
chmod 600 .env.production
~~~

Preencha os secrets e configure o DNS do domínio para o IP da VPS.

## Banco gerenciado

Configure `DATABASE_URL` com SSL no `.env.production`.

Não habilite o profile `local-db`.

## PostgreSQL na própria VPS

No `.env.production`:

~~~env
COMPOSE_PROFILES="local-db"
DATABASE_URL="postgresql://minha_escola:SENHA_FORTE@db:5432/minha_escola?schema=public"
POSTGRES_PASSWORD="SENHA_FORTE"
~~~

O serviço `db` usa rede interna e não publica a porta 5432.

## Deploy

~~~bash
bash scripts/deploy-production.sh
~~~

O script:

1. valida as variáveis principais;
2. sobe o PostgreSQL local quando o profile estiver ativo;
3. constrói a imagem;
4. executa `prisma migrate deploy` como etapa one-shot;
5. sobe aplicação e Caddy;
6. aguarda `/api/health/ready`.

## Smoke

~~~bash
set -a
source .env.production
set +a
bash scripts/smoke-production.sh
~~~

## Monitoramento

Endpoints:

- `GET /api/health`: processo e versão;
- `GET /api/health/ready`: banco/readiness;
- `GET /api/health/ops`: protegido por `Authorization: Bearer CRON_SECRET`.

O workflow `.github/workflows/production-health.yml` verifica a produção a cada 15 minutos quando `PRODUCTION_APP_URL` e `CRON_SECRET` estiverem cadastrados nos GitHub Secrets.

## Jobs

Cadastre no GitHub:

- `PRODUCTION_APP_URL`;
- `CRON_SECRET`.

O workflow `scheduled-jobs.yml` processa comunicação e manutenção.

## Backup

Banco gerenciado deve usar backup/PITR do provedor como primeira camada.

O script `scripts/backup-postgres.sh` gera dump custom + SHA-256 para uma segunda camada.

O workflow `restore-drill.yml` executa mensalmente um teste de backup/restauração em banco isolado.

## Atualização

Fluxo recomendado:

~~~bash
git pull --ff-only
bash scripts/deploy-production.sh
~~~

Nunca execute `prisma db push` em produção.

## Rollback

Se a nova versão falhar:

1. não reverta migration destrutiva no escuro;
2. volte para o commit/imagem anterior;
3. suba a aplicação anterior;
4. confira `npx prisma migrate status`;
5. valide readiness e smoke;
6. restaure banco somente quando realmente necessário e a partir de backup validado.
