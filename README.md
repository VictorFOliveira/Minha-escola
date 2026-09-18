# Minha Escola

Plataforma SaaS multi-tenant de gestão escolar para centralizar operação administrativa, acadêmica, financeira, comunicação, documentos e portais de alunos/responsáveis.

## Status

### Fase 1 — Fundação ✅
- landing page responsiva;
- dashboard administrativo;
- módulos demonstrativos de alunos, turmas, frequência e financeiro;
- API inicial;
- PostgreSQL + Prisma;
- estrutura multi-escola;
- GitHub Actions.

### Fase 2 — Autenticação e perfis ✅
- login e logout;
- sessão assinada em cookie HttpOnly;
- validação do usuário ativo no banco;
- hash de senha com bcrypt;
- perfis ADMIN, COORDINATOR, SECRETARY, TEACHER, FINANCE, STUDENT e GUARDIAN;
- menu e rotas protegidos por perfil;
- dashboard limitado conforme o perfil;
- gestão de usuários pelo administrador;
- ativação e desativação de contas;
- alteração de perfil;
- recuperação de senha com token aleatório armazenado em hash e expiração de 30 minutos;
- seed do primeiro administrador;
- endpoint de alunos protegido.

O fluxo de recuperação usa token aleatório armazenado em hash e, em produção, envia o link por e-mail através do Resend quando o provider está configurado. O token de debug permanece restrito a ambientes não produtivos.

## Stack

- Next.js 15
- React 19
- TypeScript
- PostgreSQL
- Prisma
- bcryptjs
- jose
- GitHub Actions

## Configuração local

~~~bash
npm install
cp .env.example .env
~~~

Configure DATABASE_URL, AUTH_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD e SEED_SCHOOL_NAME no arquivo .env.

A integração com Asaas é opcional. Se a escola usar baixa manual ou um sistema próprio, ASAAS_API_KEY pode permanecer vazia.

Depois execute:

~~~bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
~~~

Acesse http://localhost:3000/login.

## Perfis

| Perfil | Acesso inicial |
| --- | --- |
| ADMIN | Todos os módulos e administração de usuários |
| COORDINATOR | Estrutura acadêmica, avaliações, acompanhamento e turmas |
| SECRETARY | Alunos, matrículas, turmas e frequência |
| TEACHER | Turmas atribuídas, avaliações e diário acadêmico |
| FINANCE | Financeiro |
| STUDENT | Portal próprio vinculado à matrícula ativa/pendente |
| GUARDIAN | Portal próprio vinculado ao cadastro de responsável |

A autorização acontece no servidor. Ocultar o item do menu não é usado como mecanismo de segurança.

## Rotas principais

- / — site institucional
- /login — autenticação
- /forgot-password — solicitação de recuperação
- /reset-password — definição de nova senha
- /dashboard — painel autenticado
- /dashboard/alunos
- /dashboard/responsaveis
- /dashboard/professores
- /dashboard/funcionarios
- /dashboard/matriculas
- /dashboard/turmas
- /dashboard/escola
- /dashboard/academico
- /dashboard/avaliacoes
- /dashboard/boletins
- /dashboard/diario
- /dashboard/frequencia — redireciona para o novo diário
- /portal/aluno
- /portal/responsavel
- /dashboard/financeiro
- /dashboard/comunicacao
- /dashboard/documentos
- /dashboard/onboarding — somente ADMIN
- /dashboard/auditoria — somente ADMIN
- /dashboard/usuarios — somente ADMIN
- /superadmin — administração da plataforma
- /api/auth/login
- /api/auth/logout
- /api/auth/me
- /api/auth/forgot-password
- /api/auth/reset-password
- /api/users — somente ADMIN
- /api/students — ADMIN e SECRETARY
- /api/health
- /api/health/ready

### Fase 3 — Cadastros reais ✅
- escola e dados institucionais;
- alunos;
- responsáveis;
- vínculo responsável x aluno;
- professores;
- funcionários;
- dashboard usando dados reais do PostgreSQL.

### Fase 4 — Matrículas e rematrículas ✅
- turmas persistidas no banco;
- ano letivo, turno, sala, professor e capacidade;
- matrícula ativa ou pendente;
- proteção contra duas matrículas ativas no mesmo ano;
- controle de vagas considerando apenas matrículas ativas/pendentes;
- alteração de status para ativa, pendente, transferida ou cancelada;
- rematrícula para ano posterior;
- vínculo entre matrícula anterior e rematrícula;
- preservação do histórico acadêmico;
- filtro de matrículas por ano e busca por aluno/turma.

### Fase 5 — Estrutura acadêmica e desempenho ✅
- catálogo de disciplinas;
- períodos letivos;
- grade curricular por série/etapa e ano;
- aplicação de grade à turma;
- professor por disciplina;
- quadro de horários por disciplina;
- perfil COORDINATOR;
- conta STUDENT vinculada diretamente à matrícula;
- conta TEACHER vinculada ao cadastro docente;
- conta GUARDIAN vinculada ao responsável;
- rematrícula move automaticamente a conta do aluno para a nova matrícula;
- avaliações por disciplina e período;
- tipos de avaliação: prova, quiz, trabalho, projeto, participação e outros;
- nota máxima e peso configuráveis;
- lançamento de notas por matrícula;
- média parcial ponderada no portal do aluno;
- feedback da avaliação;
- acompanhamento formativo com visibilidade interna, aluno, responsável ou ambos;
- portal do aluno com turma, grade, professores, horários, frequência, avaliações e desempenho;
- portal do responsável isolado do backoffice;
- professor limitado às turmas/disciplinas atribuídas.

### Fase 6 — Diário do professor e frequência por disciplina ✅
- aula vinculada à disciplina real da turma;
- professor limitado às disciplinas que realmente leciona;
- data, horário e período letivo por aula;
- conteúdo previsto;
- conteúdo efetivamente ministrado;
- tarefa/atividade;
- observações do diário;
- status Planejada, Em andamento, Concluída ou Cancelada;
- chamada individual por matrícula;
- estados Presente, Falta, Atraso e Justificada;
- observação individual na chamada;
- ação para marcar a turma inteira como presente ou ausente;
- salvamento parcial da chamada;
- fechamento da aula junto com a frequência;
- frequência calculada a partir das aulas concluídas;
- frequência por disciplina no Portal do Aluno;
- registros cancelados não entram na frequência;
- rota antiga de frequência redirecionada ao novo diário.

## Segurança acadêmica

- a conta STUDENT permanece vinculada à matrícula atual;
- rematrícula transfere automaticamente o vínculo da conta para a nova matrícula;
- professor só abre diário, avaliações e chamadas das disciplinas atribuídas ao seu cadastro;
- coordenação e administrador possuem visão acadêmica transversal;
- responsável só alcança alunos ligados ao seu cadastro;
- aluno nunca usa o dashboard administrativo;
- autorização é feita no servidor e não apenas por ocultação de menu.

### Fase 7 — Boletins, recuperação e resultado final ✅
- política acadêmica por escola e ano letivo;
- média mínima configurável;
- frequência mínima configurável;
- recuperação configurável;
- três modos de cálculo de recuperação;
- peso por período letivo;
- fechamento de média por disciplina e período;
- bloqueio de fechamento com avaliações pendentes;
- média anual ponderada;
- frequência consolidada por disciplina;
- resultado anual da disciplina;
- lançamento de recuperação;
- fechamento final da matrícula;
- observação final da coordenação;
- boletim oficial no Portal do Aluno;
- professor limitado aos resultados das disciplinas atribuídas;
- fórmula compartilhada entre portal e fechamento oficial.

### Fase 8 — Financeiro escolar e pagamentos ✅
- aluno matriculado exige responsável ativo e responsável financeiro;
- responsável financeiro único por aluno;
- planos e contratos financeiros por matrícula;
- bolsas/descontos;
- geração de mensalidades;
- pagamentos parciais e baixa manual;
- inadimplência e conciliação;
- modo MANUAL por padrão;
- sistema EXTERNAL compatível;
- Asaas opcional com PIX/boleto e webhook idempotente;
- Portal do Responsável com boletins e mensalidades.

### Fase 9 — Comunicação e autorizações ✅
- central de comunicação por público;
- professor limitado às próprias turmas;
- comunicação específica do financeiro;
- prioridade normal/importante/urgente;
- anexos por link;
- caixa de entrada de aluno e responsável;
- leitura e confirmação de ciência;
- autorizações aprovadas/negadas pelo responsável;
- métricas de leitura e resposta;
- avisos automáticos de boletim e financeiro;
- Portal como canal padrão;
- e-mail/WhatsApp desacoplados e opcionais.

### Fase 10 — Secretaria e documentos verificáveis ✅
- declaração de matrícula;
- declaração de frequência;
- boletim;
- histórico;
- recibo;
- resumo/contrato de matrícula;
- documento personalizado;
- snapshot imutável da emissão;
- impressão autenticada;
- código público de verificação;
- cancelamento com preservação do histórico;
- documentos disponíveis nos portais.

### Fase 11 — SaaS, Superadmin e base de produção ✅
- slug e ciclo de vida por tenant;
- onboarding da escola;
- planos SaaS;
- assinatura/trial por escola;
- limites de alunos e usuários;
- Superadmin com autenticação separada;
- criação e suspensão de tenants;
- trilha de auditoria;
- exportação administrativa;
- job diário protegido;
- expiração de autorizações;
- avisos financeiros programáveis;
- health/readiness do PostgreSQL;
- headers básicos de segurança;
- seed de planos e Superadmin.


## Production Hardening — pré-regressão ✅

Antes da regressão ponta a ponta, a base recebeu uma camada adicional de produção:

- MFA/TOTP obrigatório para ADMIN e Superadmin, com códigos de recuperação;
- sessões persistidas, histórico de dispositivos e revogação imediata;
- eventos de segurança com request ID, IP anonimizado/hash e auditoria;
- feature flags reais por plano SaaS;
- importação em massa CSV/XLSX de alunos, responsáveis, professores, turmas e matrículas;
- exportações administrativas CSV/XLSX/PDF;
- API v1 autenticada por chave e scopes;
- webhooks de saída assinados com retry;
- modo suporte/impersonação do Superadmin com motivo obrigatório, MFA, banner e auditoria;
- idempotência em operações críticas, incluindo matrícula e criação de aluno;
- storage privado S3/R2, URLs assinadas e estado de malware scan;
- LGPD: exportação, consentimento, solicitações, retenção e anonimização controlada;
- billing do próprio SaaS separado do financeiro escolar;
- e-mail transacional, WhatsApp Meta Cloud API e filas com retry;
- rate limit persistente;
- Docker, health/readiness, jobs, backup/restore, Dependabot e CodeQL;
- CI com PostgreSQL real e testes de isolamento multi-tenant.

A regressão HTTP ponta a ponta foi executada com Next.js compilado e PostgreSQL real. O projeto também possui teste de carga com 5.000 alunos, 3.000 cobranças e 600 requisições HTTP mistas, incluindo rajada de 100 concorrentes, sem falhas no cenário de referência.

## Documentação técnica

- [Fase 6 — Diário do Professor e Frequência](docs/FASE_6_DIARIO_FREQUENCIA.md)
- [Fase 7 — Boletins e Resultado Final](docs/FASE_7_BOLETINS_RESULTADOS.md)
- [Fase 8 — Financeiro escolar e pagamentos](docs/FASE_8_FINANCEIRO.md)
- [Fase 9 — Comunicação](docs/FASE_9_COMUNICACAO.md)
- [Fase 10 — Documentos](docs/FASE_10_DOCUMENTOS.md)
- [Fase 11 — SaaS e produção](docs/FASE_11_SAAS_PRODUCAO.md)
- [Deploy em VPS](docs/VPS_DEPLOYMENT.md)
- [Homologação](docs/HOMOLOGATION.md)
- [Status de produção](docs/PRODUCTION_STATUS.md)
- [Resultado do teste de carga](docs/LOAD_TEST_RESULTS_600.md)
- [Runbook de produção](docs/PRODUCTION_RUNBOOK.md)
- [Checklist de release](docs/RELEASE_CHECKLIST.md)
- [Backup e restauração](docs/BACKUP_RESTORE.md)

## Validação de produção

Em 18/09/2026, o pacote final foi validado com PostgreSQL real e aplicação compilada:

- migration deploy + migration status verdes;
- testes unitários, integração e isolamento multi-tenant verdes;
- TypeScript e build production verdes;
- regressão HTTP ponta a ponta verde;
- dependency audit moderate+ verde;
- CodeQL verde;
- Dockerfile, Compose e Caddy validados;
- imagem Docker de produção construída com sucesso;
- 600 requisições mistas com 0 falhas, incluindo rajada de 100 concorrentes;
- backup com pg_dump + restauração em segundo banco + validação de migrations: verde.

Detalhes: [Status de produção](docs/PRODUCTION_STATUS.md), [teste de carga](docs/LOAD_TEST_RESULTS_600.md) e [backup/restore](docs/BACKUP_RESTORE.md).

## Estado do produto

As 11 fases planejadas estão implementadas na base do produto.

O código e os artefatos de produção estão prontos para homologação/VPS, incluindo package-lock, migration baseline, Docker, Caddy/HTTPS, deploy com migrate deploy, smoke test, health monitor e restore drill. Para um go-live real ainda é necessário provisionar a infraestrutura externa e cadastrar seus segredos: VPS/containers, domínio/DNS, banco/bucket/scanner e credenciais opcionais de Sentry, Asaas, Resend e Meta WhatsApp.
