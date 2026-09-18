# Pendências conhecidas — Minha Escola

Atualizado em 18/09/2026 após revisão do `main`.

## Resumo

As 11 fases funcionais, hardening, migrations, regressão HTTP, segurança, Docker, backup/restore e teste de carga estão implementados e validados no ambiente de CI.

O projeto deve ser tratado como **release candidate pronto para homologação**, e não como go-live concluído, até fechar os itens abaixo.

## P0 — fechar antes de produção real

### 1. Dashboard inicial ainda usa dados fictícios

`app/dashboard/page.tsx` importa `@/lib/mock-data`.

Hoje os cards de métricas, alunos recentes, atividade e o gráfico semanal exibidos na home do dashboard são dados sintéticos. Os módulos de alunos, turmas, financeiro, acadêmico e demais áreas já usam dados persistidos, mas o resumo da home ainda precisa consultar o PostgreSQL.

Critério de aceite:

- métricas calculadas por tenant;
- alunos recentes reais;
- atividade recente real ou seção removida até existir trilha adequada;
- frequência agregada real;
- financeiro agregado real apenas para perfis autorizados;
- nenhum dado de `lib/mock-data.ts` exibido após login.

### 2. Entrada do responsável possui texto legado

No `/dashboard`, o perfil GUARDIAN ainda recebe uma mensagem dizendo que notas, frequência, boletos e comunicados "serão conectados na fase do portal".

O Portal do Responsável já está implementado. O fluxo deve redirecionar para `/portal/responsavel` ou exibir mensagem compatível com o estado atual.

### 3. Homologação em infraestrutura real

O CI valida o pacote, mas não substitui homologação no ambiente contratado.

Ainda precisa validar na VPS/plataforma final:

- domínio e DNS;
- HTTPS real;
- PostgreSQL final;
- storage S3/R2 privado;
- scanner de malware real;
- upload e download real;
- secrets de produção;
- jobs agendados;
- health monitor;
- backup/PITR do provedor;
- restore usando o ambiente real.

### 4. Carga na infraestrutura escolhida

O baseline de CI com 5.000 alunos e 600 requisições passou sem falhas, mas CPU, RAM, I/O, rede e PostgreSQL da VPS mudam o resultado.

Antes do go-live, repetir o teste de carga na infraestrutura final e registrar novo baseline.

## P1 — configuração operacional

- configurar `PRODUCTION_APP_URL` e `CRON_SECRET` nos GitHub Secrets;
- confirmar que `production-health.yml` está recebendo sinais do ambiente real;
- confirmar execução real de `scheduled-jobs.yml`;
- ativar alertas de disponibilidade/erros;
- configurar retenção e rotina de backup;
- validar Resend, Meta WhatsApp e Asaas somente quando esses canais forem ativados pela escola;
- cadastrar secrets independentes para MFA e criptografia de integrações.

## P2 — acabamento

- atualizar a landing page, que ainda usa a frase "está sendo construído por fases";
- remover `lib/mock-data.ts` depois da migração do dashboard para dados reais;
- fazer uma rodada final de UX/mobile nos portais e backoffice com dados de homologação.

## O que já está fechado

- 11 fases do produto;
- responsável obrigatório na matrícula e responsável financeiro;
- financeiro MANUAL/EXTERNAL e Asaas opcional;
- portais de aluno e responsável;
- multi-tenant;
- autenticação, RBAC e MFA;
- idempotência;
- proteção de upload e malware scan fail-closed em produção;
- LGPD;
- API v1 e webhooks;
- performance gate;
- regressão HTTP;
- CodeQL e dependency audit;
- migrations reprodutíveis;
- Docker/Compose/Caddy;
- backup e restore drill;
- teste de carga de referência com 600 requisições e 0 falhas.

## Critério para declarar go-live fechado

Só marcar produção como concluída quando:

1. o dashboard não usar mais mock;
2. o fluxo GUARDIAN estiver coerente com o portal existente;
3. homologação real estiver aprovada;
4. upload/scanner, jobs, monitoramento e backup estiverem validados no ambiente final;
5. o teste de carga da infraestrutura escolhida estiver dentro dos limites definidos.
