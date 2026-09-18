# Production Hardening Checklist

## Implementado no código

- [x] PostgreSQL + Prisma;
- [x] migration baseline versionada + migration deploy;
- [x] package-lock e builds reprodutíveis com npm ci;
- [x] isolamento por tenant;
- [x] MFA/TOTP para perfis críticos;
- [x] sessões persistidas e revogáveis;
- [x] rate limit persistente;
- [x] idempotência em operações críticas;
- [x] storage S3-compatible privado;
- [x] upload/download assinado;
- [x] malware scan fail-closed por padrão em produção;
- [x] PDF server-side;
- [x] comunicação via Resend;
- [x] comunicação WhatsApp via Meta Cloud API;
- [x] recuperação de senha por e-mail em produção;
- [x] billing do próprio SaaS;
- [x] webhook idempotente de billing;
- [x] período de carência e suspensão;
- [x] LGPD: exportação, solicitações, consentimento e anonimização;
- [x] retenção configurável de auditoria;
- [x] audit trail e eventos de segurança;
- [x] API v1 + scopes;
- [x] webhooks assinados com retry;
- [x] Docker;
- [x] Caddy/HTTPS para VPS;
- [x] health/readiness;
- [x] health operacional protegido;
- [x] jobs programados;
- [x] backup/restore scripts;
- [x] restore drill automatizado;
- [x] health monitor de produção;
- [x] Dependabot;
- [x] dependency audit moderate+;
- [x] CodeQL;
- [x] testes unitários;
- [x] testes multi-tenant com PostgreSQL;
- [x] regressão HTTP com aplicação compilada;
- [x] teste de carga 5.000 alunos / 600 requisições;
- [x] paginação e limites para listas de grande volume;
- [x] pipeline CI com banco real.

## Precisa de infraestrutura/credenciais no ambiente

- [ ] VPS/plataforma de containers provisionada;
- [ ] domínio/DNS apontado;
- [ ] TLS emitido no domínio real;
- [ ] PostgreSQL de produção ou profile local-db escolhido;
- [ ] backup/PITR do provedor, quando disponível;
- [ ] bucket S3/R2 privado provisionado;
- [ ] scanner de malware provisionado;
- [ ] Sentry/alertas provisionados;
- [ ] credenciais Resend;
- [ ] credenciais Meta WhatsApp;
- [ ] credenciais Asaas da plataforma, se cobrança automática for ativada;
- [ ] credenciais Asaas da escola, se a escola optar por esse gateway;
- [ ] GitHub Secrets PRODUCTION_APP_URL e CRON_SECRET.

Esses itens permanecem desmarcados porque dependem de contas e credenciais externas, não porque falte implementação no repositório.

## Gate antes de produção

Antes do go-live:

1. validar CI e CodeQL no commit da release;
2. executar migration deploy no ambiente de homologação;
3. executar smoke e regressão;
4. confirmar backup + restore drill;
5. validar scanner real de upload;
6. validar canais externos ativados;
7. liberar tráfego somente após readiness verde.
