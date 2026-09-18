# Backup e restauração

## Estratégia recomendada

Use duas camadas:

1. snapshots/backups automáticos do PostgreSQL gerenciado;
2. `pg_dump` periódico para storage privado separado.

Não armazene backup de produção como artifact público ou de longa retenção do GitHub Actions.

## Backup manual

```bash
export DATABASE_URL='postgresql://...'
export BACKUP_DIR=/backups/minha-escola
export BACKUP_RETENTION_DAYS=14
./scripts/backup-postgres.sh
```

O formato custom do `pg_dump` permite restauração seletiva e compressão interna.

## Restore drill

Sempre faça o teste em um banco descartável:

```bash
export DATABASE_URL='postgresql://.../minha_escola_restore_test'
export ALLOW_DATABASE_RESTORE=YES_I_KNOW
./scripts/restore-postgres.sh backups/minha-escola-AAAAmmddTHHMMSSZ.dump
npm run db:migrate:deploy
```

Depois valide:

- `/api/health/ready`;
- contagem de escolas/alunos;
- login de conta de teste;
- um boletim;
- uma cobrança;
- um documento verificável.

## Frequência

Para produção comercial:

- backup diário no mínimo;
- retenção compatível com política da organização;
- teste de restauração recorrente;
- alertas para falhas;
- cópia em região/storage separado quando o provedor permitir.
