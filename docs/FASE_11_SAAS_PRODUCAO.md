# Fase 11 — SaaS, Superadmin e produção

## Multi-tenant

Cada escola é um tenant isolado por `schoolId`.

O tenant possui slug único, status de ciclo de vida, onboarding, assinatura, plano e limites.

Status do tenant:

- ONBOARDING
- TRIAL
- ACTIVE
- SUSPENDED
- CANCELLED

Sessões de tenants suspensos ou cancelados são recusadas no servidor.

## Planos SaaS

`SaaSPlan` suporta preço mensal, preço anual, limite de alunos, limite de usuários e features em JSON.

Os limites de alunos e usuários são aplicados no backend.

## Assinatura

`SchoolSubscription` mantém plano, status, provedor, ID externo, trial e período corrente.

Status:

- TRIAL
- ACTIVE
- PAST_DUE
- SUSPENDED
- CANCELLED

## Superadmin

O Superadmin possui autenticação separada da escola.

Rotas principais:

- `/superadmin/login`
- `/superadmin`
- `/api/platform/auth/login`
- `/api/platform/auth/logout`
- `/api/platform/plans`
- `/api/platform/schools`
- `/api/platform/schools/:id`

O Superadmin pode criar planos, criar tenants, definir o primeiro administrador, escolher plano inicial, alterar plano e suspender/reativar tenants.

## Onboarding

O primeiro ADMIN de um tenant novo é direcionado para `/dashboard/onboarding`.

Quando existe plano STARTER e a escola ainda não possui assinatura, o onboarding cria um trial de 14 dias.

## Auditoria

`AuditLog` registra ações de usuários, Superadmin e sistema.

A escola possui `/dashboard/auditoria`.

## Exportação

ADMIN pode baixar um JSON administrativo em `/api/admin/export`.

Hashes de senha não fazem parte do export.

Backups de banco continuam sendo responsabilidade também da camada de infraestrutura do PostgreSQL/hosting.

## Job diário

`POST /api/jobs/daily` com `Authorization: Bearer CRON_SECRET`.

O job expira autorizações, trata fim de trial, atualiza inadimplência e gera lembretes financeiros idempotentes.

## Health checks

- `/api/health` — liveness
- `/api/health/ready` — readiness com consulta real ao PostgreSQL

## Produção

Segredos mínimos:

- DATABASE_URL
- AUTH_SECRET
- PLATFORM_AUTH_SECRET
- CRON_SECRET
- credenciais opcionais do Asaas
- credenciais opcionais dos provedores de comunicação

Domínio, TLS, backup automático e observabilidade de infraestrutura devem ser configurados no provedor escolhido no deploy real.
