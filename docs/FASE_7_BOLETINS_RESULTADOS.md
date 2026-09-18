# Fase 7 — Boletins, recuperação e resultado final

## Objetivo

Transformar avaliações e frequência em um fechamento acadêmico formal, auditável e configurável por escola.

Fluxo principal:

```
Avaliações
  -> média do período
    -> média anual por disciplina
      -> recuperação, quando necessária
        -> resultado final da disciplina
          -> resultado final da matrícula
            -> boletim oficial no Portal do Aluno
```

## Política acadêmica

A política é configurada por escola e ano letivo.

Campos:

- média mínima para aprovação;
- frequência mínima;
- recuperação habilitada ou não;
- regra de recuperação.

Modos de recuperação:

- `REPLACE_IF_HIGHER`: usa a maior entre média anual e recuperação;
- `AVERAGE_WITH_ANNUAL`: calcula a média entre a média anual e a recuperação;
- `MANUAL`: coordenação/professor informa a média final manualmente.

Os valores padrão do produto são apenas valores iniciais de configuração e não representam alegação de conformidade automática com norma ou regimento específico.

## Peso dos períodos

Cada período letivo possui `weight`.

Isso permite:

- bimestres com o mesmo peso;
- semestres;
- períodos com pesos diferentes;
- composição anual sem hardcode de fórmula.

## Fechamento do período

O fechamento de uma disciplina/período só é permitido quando:

1. existem avaliações publicadas;
2. todas essas avaliações estão em status `CLOSED`;
3. cada matrícula aplicável possui:
   - nota; ou
   - falta registrada; ou
   - falta justificada.

Regras de cálculo:

- nota é normalizada para escala 0–10;
- peso da avaliação participa da média ponderada;
- falta não justificada sem nota vale 0;
- falta justificada é desconsiderada do divisor;
- avaliação sem lançamento impede o fechamento.

A média fechada é persistida em `PeriodGrade`.

## Fechamento anual da disciplina

Após todos os períodos estarem fechados, o sistema calcula:

- média anual ponderada pelos pesos dos períodos;
- frequência da disciplina usando `LessonAttendance`;
- necessidade de recuperação;
- média final;
- situação final da disciplina.

Situações possíveis:

- `IN_PROGRESS`;
- `APPROVED`;
- `RECOVERY`;
- `FAILED_GRADE`;
- `FAILED_ATTENDANCE`.

O snapshot final fica em `SubjectFinalResult`.

## Recuperação

A recuperação é vinculada à matrícula e à disciplina.

O resultado é recalculado usando a política acadêmica do ano.

A frequência mínima continua sendo avaliada separadamente da média.

## Resultado da matrícula

O resultado global da matrícula só pode ser fechado quando nenhuma disciplina estiver:

- em andamento;
- em recuperação pendente.

O fechamento gera `EnrollmentAcademicResult`:

- `APPROVED`;
- `FAILED`;
- `IN_PROGRESS`.

Administração/coordenação podem incluir uma observação final de fechamento.

## Portal do Aluno

O aluno visualiza:

- notas fechadas por período;
- média anual;
- nota de recuperação;
- média final;
- frequência por disciplina;
- situação de cada componente curricular;
- resultado geral da matrícula;
- observação final, quando publicada.

O boletim usa exclusivamente a matrícula vinculada à sessão do aluno.

## Segurança

### Professor

A API devolve somente:

- disciplinas atribuídas ao professor;
- notas e resultados dessas disciplinas.

Não basta esconder colunas na interface: o filtro é aplicado no backend.

### Coordenação e administração

Possuem visão transversal do fechamento acadêmico da escola.

### Aluno

Consulta apenas o boletim da matrícula vinculada à própria conta.

## Endpoints principais

- `GET /api/academic-policy?schoolYear=...`
- `PUT /api/academic-policy`
- `GET /api/report-cards/class/:id`
- `POST /api/report-cards/close-period`
- `POST /api/report-cards/close-subject`
- `PUT /api/report-cards/recovery`
- `POST /api/report-cards/finalize-enrollment`

## Interface

- `/dashboard/boletins` — central de fechamento;
- `/portal/aluno#boletim` — boletim oficial do aluno.

## Fonte dos dados

A Fase 7 não cria uma nota paralela.

Ela usa:

- `Assessment`;
- `AssessmentScore`;
- `AcademicPeriod`;
- `Lesson`;
- `LessonAttendance`.

Os modelos `PeriodGrade`, `SubjectFinalResult` e `EnrollmentAcademicResult` armazenam snapshots de fechamento para preservar o resultado acadêmico consolidado.

## Banco de dados

Em desenvolvimento:

```bash
npm run db:generate
npm run db:push
```

Em produção, usar migração versionada antes do deploy.
