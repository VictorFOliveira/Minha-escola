# Release checklist

## Gate automático

A release só deve avançar quando:

- Prisma schema válido;
- migration aplicada em PostgreSQL vazio;
- testes unitários verdes;
- testes de isolamento multi-tenant verdes;
- TypeScript verde;
- Next.js build verde;
- CodeQL sem achado bloqueador definido pela equipe;
- readiness verde.

## Gate operacional

- [ ] secrets de produção cadastrados;
- [ ] `APP_URL` com domínio HTTPS;
- [ ] banco gerenciado provisionado;
- [ ] migration deploy executada;
- [ ] backup automático habilitado;
- [ ] restore drill realizado;
- [ ] bucket privado configurado;
- [ ] cron configurado;
- [ ] alertas de disponibilidade configurados;
- [ ] credenciais dos canais opcionais configuradas;
- [ ] webhook da escola configurado somente se necessário;
- [ ] webhook da plataforma configurado se cobrança SaaS automática estiver ativa.

## Gate de dados

Antes de importar uma escola real:

- valide responsável financeiro de todos os alunos;
- normalize matrícula/CPF/CNPJ;
- valide turmas e ano letivo;
- confira usuários com privilégios administrativos;
- importe em ambiente de homologação;
- compare totais de alunos, turmas e cobranças;
- faça export do ambiente importado antes do go-live.

## Gate final

Após os itens acima, execute a regressão ponta a ponta completa.

A regressão deve cobrir:

- criação do tenant;
- onboarding;
- usuários e papéis;
- aluno + responsável;
- matrícula;
- estrutura acadêmica;
- professor;
- diário e presença;
- avaliações/notas;
- boletim;
- financeiro;
- comunicação;
- autorização;
- documentos;
- rematrícula;
- isolamento entre tenants;
- suspensão/reativação;
- LGPD;
- billing da plataforma.
