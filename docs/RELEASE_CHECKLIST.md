# Release checklist

## Gate automático

A release só avança quando o commit candidato comprovar:

- [ ] package-lock presente;
- [ ] migration baseline presente;
- [ ] Prisma schema válido;
- [ ] `prisma migrate deploy` aplicado em PostgreSQL vazio;
- [ ] testes unitários verdes;
- [ ] testes de isolamento multi-tenant verdes;
- [ ] teste de idempotência verde;
- [ ] teste XLSX/import-export verde;
- [ ] performance database gate verde;
- [ ] TypeScript verde;
- [ ] Next.js build production verde;
- [ ] regressão HTTP verde;
- [ ] dependency audit em nível moderate+ verde;
- [ ] CodeQL verde;
- [ ] readiness verde.

## Gate de carga

Para releases que alterem consultas, autenticação, financeiro, sessão ou banco:

- [ ] cenário de 5.000 alunos executado;
- [ ] pelo menos 400 requisições HTTP;
- [ ] rajada concorrente executada;
- [ ] sem 5xx/timeouts inesperados;
- [ ] p95 comparado ao baseline documentado.

Baseline atual: `docs/LOAD_TEST_RESULTS_600.md`.

## Gate operacional

- [ ] VPS/plataforma provisionada;
- [ ] `.env.production` preenchido fora do Git;
- [ ] `APP_URL` HTTPS;
- [ ] domínio/DNS resolvendo;
- [ ] PostgreSQL provisionado;
- [ ] migration deploy executada;
- [ ] backup automático/PITR habilitado;
- [ ] restore drill validado;
- [ ] bucket privado;
- [ ] malware scanner ativo;
- [ ] Sentry/alertas, quando adotados;
- [ ] GitHub Secrets `PRODUCTION_APP_URL` e `CRON_SECRET`;
- [ ] canais externos desejados configurados;
- [ ] webhooks Asaas configurados quando utilizados.

## Gate de dados

Antes de importar uma escola real:

- [ ] responsável financeiro de todos os alunos validado;
- [ ] matrículas/CPF/CNPJ normalizados;
- [ ] turmas e ano letivo conferidos;
- [ ] usuários privilegiados revisados;
- [ ] importação ensaiada em homologação;
- [ ] totais comparados;
- [ ] export de segurança gerado antes do go-live.

## Gate funcional

A regressão deve cobrir:

- tenant/onboarding;
- papéis e permissões;
- aluno + responsável;
- matrícula/rematrícula;
- estrutura acadêmica;
- professor/diário/frequência;
- avaliações/notas/boletim;
- financeiro/pagamento;
- comunicação/autorização;
- documentos/PDF;
- portais;
- isolamento cross-tenant;
- suspensão/reativação;
- LGPD;
- billing da plataforma;
- replay idempotente;
- sessão revogada;
- upload/scanner no ambiente real.

## Go-live

Somente liberar tráfego quando:

1. gates automáticos estiverem verdes;
2. homologação tiver sido aprovada;
3. backup estiver ativo;
4. readiness estiver verde;
5. monitoramento estiver recebendo sinais;
6. houver procedimento de rollback disponível.
