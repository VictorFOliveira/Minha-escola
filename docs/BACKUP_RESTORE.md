# Backup e restauração

## Estratégia recomendada

Use duas camadas:

1. snapshots/backups automáticos do PostgreSQL gerenciado;
2. `pg_dump` periódico para storage privado separado.

Não armazene backup de produção como artifact público ou de longa retenção do GitHub Actions.

## Compatibilidade com DATABASE_URL do Prisma

A URL do Prisma pode conter parâmetros próprios, como:

~~~text
?schema=public
~~~

`pg_dump` e `pg_restore` não entendem esse parâmetro. Os scripts do projeto sanitizam a URL automaticamente, removendo somente `schema` e preservando os demais parâmetros compatíveis, como SSL.

## Backup manual

~~~bash
export DATABASE_URL='postgresql://.../minha_escola?schema=public'
export BACKUP_DIR=/backups/minha-escola
export BACKUP_RETENTION_DAYS=14
bash scripts/backup-postgres.sh
~~~

O script gera dump custom e, quando disponível, arquivo SHA-256.

## Restore manual

Sempre restaure primeiro em banco descartável:

~~~bash
export DATABASE_URL='postgresql://.../minha_escola_restore_test?schema=public'
export ALLOW_DATABASE_RESTORE=YES_I_KNOW
bash scripts/restore-postgres.sh backups/minha-escola-AAAAmmddTHHMMSSZ.dump
npm run db:migrate:deploy
~~~

Depois valide:

- `/api/health/ready`;
- contagem de escolas/alunos;
- login de conta de teste;
- um boletim;
- uma cobrança;
- um documento verificável.

## Restore drill automatizado

O workflow `.github/workflows/restore-drill.yml` roda:

- mensalmente;
- manualmente;
- quando migrations ou scripts de backup/restore mudam em PR.

O drill:

1. sobe PostgreSQL 16 limpo;
2. aplica migrations;
3. cria um registro marcador;
4. gera `pg_dump`;
5. cria segundo banco vazio;
6. restaura o dump;
7. valida o registro marcador;
8. valida o histórico `_prisma_migrations`.

### Última validação

Em **18/09/2026**, o restore drill passou de ponta a ponta:

- backup: OK;
- criação do banco destino: OK;
- `pg_restore`: OK;
- dado restaurado: OK;
- histórico de migrations: OK.

## Frequência de produção

Para produção comercial:

- backup diário no mínimo;
- PITR do provedor quando disponível;
- retenção compatível com a política da organização;
- teste de restauração recorrente;
- alertas para falhas;
- cópia em região/storage separado quando o provedor permitir.

O drill de CI comprova a mecânica dos scripts. O backup do provedor/VPS real ainda deve ser validado no ambiente efetivamente contratado.
