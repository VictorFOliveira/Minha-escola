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
- perfis ADMIN, SECRETARY, TEACHER, FINANCE e GUARDIAN;
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
| SECRETARY | Alunos, turmas e frequência |
| TEACHER | Turmas e frequência |
| FINANCE | Financeiro |
| GUARDIAN | Login isolado; portal do responsável será conectado em fase posterior |

A autorização acontece no servidor. Ocultar o item do menu não é usado como mecanismo de segurança.

## Rotas principais

- / — site institucional
- /login — autenticação
- /forgot-password — solicitação de recuperação
- /reset-password — definição de nova senha
- /dashboard — painel autenticado
- /dashboard/alunos
- /dashboard/turmas
- /dashboard/frequencia
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

## Próximas fases

3. Cadastros principais reais: escola, alunos, responsáveis, professores e funcionários.
4. Matrículas e rematrículas.
5. Estrutura acadêmica: disciplinas, grade curricular e períodos.
6. Frequência e diário do professor.
7. Notas, avaliações e boletins.
8. Financeiro completo e pagamentos.
9. Portal do responsável e comunicação.
10. Secretaria e documentos oficiais.
11. SaaS, produção, assinaturas e superadmin.
