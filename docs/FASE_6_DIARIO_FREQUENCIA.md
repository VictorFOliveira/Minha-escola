# Fase 6 — Diário do Professor e Frequência por Disciplina

## Objetivo

Substituir a frequência genérica por aluno/dia por um modelo acadêmico baseado em aula real.

A fonte de verdade da frequência passa a ser:

```
Matrícula
  -> Turma
    -> Disciplina da turma
      -> Aula do diário
        -> Chamada da matrícula
```

Isso permite que um aluno esteja presente em uma disciplina e ausente em outra no mesmo dia.

## Modelos principais

### Lesson

Representa uma aula registrada no diário.

Campos relevantes:

- `classSubjectId`: disciplina real da turma;
- `periodId`: bimestre/trimestre/semestre, quando aplicável;
- `createdByUserId`: usuário que criou o registro;
- `lessonDate`;
- `startTime` e `endTime`;
- `plannedContent`: conteúdo previsto;
- `taughtContent`: conteúdo efetivamente ministrado;
- `homework`: tarefa ou atividade;
- `notes`: observações gerais;
- `status`: `PLANNED`, `OPEN`, `COMPLETED` ou `CANCELLED`.

### LessonAttendance

Representa a chamada de uma matrícula em uma aula.

Campos relevantes:

- `lessonId`;
- `enrollmentId`;
- `recordedByUserId`: usuário que lançou/alterou a presença;
- `status`: `PRESENT`, `ABSENT`, `LATE` ou `EXCUSED`;
- `note`: observação individual.

Existe uma única chamada por `lessonId + enrollmentId`.

## Regra de acesso

### ADMIN

Pode consultar e operar qualquer disciplina da escola.

### COORDINATOR

Possui visão acadêmica transversal e pode operar diário e frequência de qualquer turma da escola.

### TEACHER

Só consegue abrir diário, aula ou chamada de `ClassSubject` cujo `teacherId` seja o professor vinculado à sua conta.

A checagem é feita no servidor via `lib/academic-access.ts`.

### STUDENT

Não acessa o dashboard administrativo.

A conta é vinculada diretamente à matrícula ativa/pendente e o Portal do Aluno consulta somente a frequência dessa matrícula.

### GUARDIAN

O acesso permanece limitado aos alunos vinculados ao cadastro do responsável.

## Fluxo do professor

1. Acessa **Diário & Frequência**.
2. Seleciona uma turma disponível para o seu perfil.
3. Seleciona uma disciplina que leciona.
4. Cria uma aula.
5. Registra período, data e horários.
6. Informa conteúdo previsto e/ou ministrado.
7. Informa tarefa e observações.
8. Abre a chamada.
9. Marca cada matrícula como:
   - Presente;
   - Falta;
   - Atraso;
   - Justificada.
10. Pode salvar parcialmente a chamada.
11. Para **concluir a aula**, todos os alunos ativos/pendentes da turma devem estar presentes na lista de chamada.
12. Ao concluir, a aula passa a integrar o cálculo de frequência do Portal do Aluno.

## Regras de integridade

- aula cancelada não aceita chamada;
- aula concluída não pode ser excluída;
- matrícula de outra turma não pode ser enviada para a chamada;
- matrículas duplicadas no mesmo payload são rejeitadas;
- ao concluir a aula, a chamada precisa contemplar toda a turma;
- cada alteração de presença registra o usuário responsável;
- professor não pode lançar frequência de disciplina não atribuída a ele;
- datas de aula são normalizadas para evitar deslocamento de dia por fuso horário.

## Portal do Aluno

O Portal do Aluno calcula frequência com base em `LessonAttendance` de aulas `COMPLETED`.

Para a taxa atual:

- `PRESENT` conta como presença;
- `LATE` conta como presença;
- `ABSENT` conta como ausência;
- `EXCUSED` permanece registrada separadamente e atualmente participa do total da frequência.

O portal também exibe o detalhamento por disciplina:

- número de aulas contabilizadas;
- presenças;
- atrasos;
- faltas;
- justificadas;
- percentual de frequência.

A política de como faltas justificadas impactam o percentual pode futuramente virar uma configuração da escola.

## Endpoints

### Aulas

- `GET /api/lessons?classSubjectId=...`
- `POST /api/lessons`
- `GET /api/lessons/:id`
- `PATCH /api/lessons/:id`
- `DELETE /api/lessons/:id`

### Chamada

- `GET /api/lessons/:id/attendance`
- `PUT /api/lessons/:id/attendance`

## Rotas de interface

- `/dashboard/diario` — diário e chamada;
- `/dashboard/frequencia` — rota legada que redireciona para o novo diário;
- `/portal/aluno` — frequência consolidada e por disciplina.

## Compatibilidade com o modelo antigo

O modelo Prisma `Attendance` ainda existe temporariamente porque pertence às fases iniciais do projeto.

Ele não é mais a fonte de verdade do novo fluxo.

A nova implementação usa exclusivamente:

- `Lesson`;
- `LessonAttendance`.

Uma migração futura pode remover `Attendance` depois que não houver dependências históricas ou dados legados a preservar.

## Banco de dados

Após atualizar o código, a estrutura precisa ser aplicada ao PostgreSQL.

Em ambiente de desenvolvimento:

```bash
npm run db:generate
npm run db:push
```

Para produção, usar migração versionada antes do deploy.
