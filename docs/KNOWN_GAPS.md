# Pendências conhecidas — Minha Escola

Atualizado em 18/09/2026 após remoção dos mocks do dashboard.

## Resumo

As 11 fases funcionais, hardening, migrations, regressão HTTP, segurança, Docker, backup/restore e teste de carga estão implementados.

A revisão final de código também foi fechada:

- dashboard inicial usa dados reais do PostgreSQL e respeita o tenant;
- métricas são filtradas por perfil;
- professor enxerga somente as próprias turmas/frequência;
- aluno é direcionado para `/portal/aluno`;
- responsável é direcionado para `/portal/responsavel`;
- `lib/mock-data.ts` foi removido;
- landing page não informa mais que as fases ainda estão em construção.

O estado do produto agora é **pronto para homologação final em infraestrutura real**.

## O que ainda falta para o go-live

Esses itens dependem do ambiente contratado e não podem ser encerrados apenas no repositório.

### Infraestrutura

- provisionar VPS/plataforma de containers;
- configurar domínio e DNS;
- validar HTTPS real;
- provisionar PostgreSQL final;
- configurar storage S3/R2 privado;
- configurar scanner de malware;
- cadastrar secrets de produção.

### Operação

- configurar `PRODUCTION_APP_URL` e `CRON_SECRET` nos GitHub Secrets;
- confirmar o `production-health.yml` contra a URL real;
- confirmar execução real de `scheduled-jobs.yml`;
- ativar alertas;
- habilitar backup/PITR;
- executar restore drill contra o ambiente contratado.

### Integrações opcionais

Conforme a escola decidir ativar:

- Resend;
- Meta WhatsApp;
- Asaas escolar;
- Asaas da plataforma;
- Sentry.

### Teste final de capacidade

O baseline de CI com 5.000 alunos e 600 requisições passou sem falhas, mas a capacidade real depende de CPU, RAM, I/O, rede e banco.

Antes de liberar tráfego real:

1. popular homologação com volume representativo;
2. repetir o teste de carga na infraestrutura final;
3. registrar p95 e erros;
4. ajustar VPS/banco se necessário.

## Fechado no código

- 11 fases do produto;
- dashboard real sem mock;
- responsável obrigatório e responsável financeiro;
- financeiro MANUAL/EXTERNAL e Asaas opcional;
- portais de aluno e responsável;
- multi-tenant;
- autenticação, RBAC e MFA;
- sessões revogáveis;
- idempotência;
- upload privado e malware scan fail-closed;
- LGPD;
- API v1;
- webhooks assinados;
- rate limit;
- importação/exportação;
- migrations versionadas;
- Docker/Compose/Caddy;
- health/readiness;
- backup/restore;
- CodeQL e dependency audit;
- regressão HTTP;
- teste de carga de referência.

## Critério para declarar produção encerrada

O código não possui mais bloqueador funcional conhecido para homologação.

O go-live é considerado encerrado quando infraestrutura, secrets, storage/scanner, jobs, monitoramento, backup/restore e teste de carga na VPS final estiverem validados.
