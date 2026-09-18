# Minha Escola

Plataforma web de gestão escolar criada para centralizar a rotina administrativa, acadêmica e financeira de uma instituição de ensino.

## Estado atual

A Fase 1 já entrega:

- landing page responsiva;
- dashboard administrativo;
- módulo inicial de alunos;
- módulo inicial de turmas;
- acompanhamento de frequência;
- visão financeira;
- API de health check;
- endpoint demonstrativo de alunos;
- modelagem PostgreSQL com Prisma;
- estrutura multi-escola;
- CI com typecheck e build.

## Stack

- Next.js
- React
- TypeScript
- PostgreSQL
- Prisma
- GitHub Actions

## Rodando localmente

~~~bash
npm install
cp .env.example .env
npm run db:generate
npm run dev
~~~

A aplicação abre em `http://localhost:3000`.

## Banco de dados

Configure `DATABASE_URL` no arquivo `.env`.

Exemplo:

~~~env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/minha_escola?schema=public"
~~~

Depois execute:

~~~bash
npm run db:push
~~~

## Rotas iniciais

- `/` — site institucional
- `/dashboard` — painel
- `/dashboard/alunos`
- `/dashboard/turmas`
- `/dashboard/frequencia`
- `/dashboard/financeiro`
- `/api/health`
- `/api/students`

## Roadmap

### Fase 2 — operação real
- autenticação e perfis de acesso;
- CRUD de escola, alunos, professores e responsáveis;
- persistência real em PostgreSQL;
- matrículas e rematrículas;
- disciplinas e grade curricular.

### Fase 3 — acadêmico
- chamada pelo professor;
- notas e avaliações;
- boletim;
- ocorrências;
- calendário letivo.

### Fase 4 — financeiro e comunicação
- PIX e boleto;
- conciliação;
- inadimplência;
- notificações;
- portal do responsável.

### Fase 5 — expansão
- app/PWA do professor e responsável;
- relatórios;
- exportações;
- auditoria;
- multiunidade avançada.
