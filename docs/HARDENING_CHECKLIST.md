# Production Hardening Checklist

## Implementado no código

- [x] PostgreSQL + Prisma;
- [x] isolamento por tenant;
- [x] rate limit persistente;
- [x] storage S3-compatible privado;
- [x] upload/download assinado;
- [x] PDF server-side;
- [x] comunicação real via Resend;
- [x] comunicação WhatsApp via Meta Cloud API;
- [x] recuperação de senha por e-mail em produção;
- [x] billing do próprio SaaS;
- [x] webhook idempotente de billing;
- [x] período de carência e suspensão;
- [x] LGPD: exportação, solicitações, consentimento e anonimização;
- [x] retenção configurável de auditoria;
- [x] audit trail;
- [x] Docker;
- [x] health/readiness;
- [x] jobs programados;
- [x] backup/restore scripts;
- [x] Dependabot;
- [x] testes unitários;
- [x] testes multi-tenant com PostgreSQL;
- [x] pipeline CI com banco real.

## Precisa de infraestrutura/credenciais no ambiente

- [ ] domínio;
- [ ] TLS do provedor;
- [ ] PostgreSQL gerenciado;
- [ ] storage S3/R2 privado;
- [ ] backups gerenciados;
- [ ] observabilidade/alertas;
- [ ] credenciais Resend;
- [ ] credenciais Meta WhatsApp;
- [ ] credenciais Asaas da plataforma, se cobrança automática for ativada;
- [ ] credenciais Asaas da escola, se a escola optar por esse gateway.

## Gate antes de produção

A regressão ponta a ponta deve ser executada somente depois que CI, migration e ambiente de teste estiverem verdes.
