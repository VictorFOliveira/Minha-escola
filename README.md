# Minha Escola

Plataforma web de gestão escolar para centralizar a rotina administrativa, acadêmica e financeira de uma instituição de ensino.

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

O fluxo de recuperação funciona em desenvolvimento mostrando o link diretamente. Para produção ainda será necessário conectar um provedor de e-mail para entregar esse link ao usuário.

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
- /dashboard/frequencia
- /portal/aluno
- /portal/responsavel
- /dashboard/financeiro
- /dashboard/usuarios — somente ADMIN
- /api/auth/login
- /api/auth/logout
- /api/auth/me
- /api/auth/forgot-password
- /api/auth/reset-password
- /api/users — somente ADMIN
- /api/students — ADMIN e SECRETARY
- /api/health

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

## Próximas fases

6. Frequência por disciplina e diário completo do professor.
7. Notas, avaliações e boletins.
8. Financeiro completo e pagamentos.
9. Portal do responsável e comunicação.
10. Secretaria e documentos oficiais.
11. SaaS, produção, assinaturas e superadmin.
