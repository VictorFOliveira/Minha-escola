import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { calculatePeriodAverage } from "@/lib/grade-calculations";
import { CommunicationInbox } from "@/components/communication-inbox";
import { PortalDocuments } from "@/components/portal-documents";
import { PrivacyPortal } from "@/components/privacy-portal";

const weekdays: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

const assessmentTypeLabels: Record<string, string> = {
  EXAM: "Prova",
  QUIZ: "Quiz",
  ASSIGNMENT: "Trabalho",
  PROJECT: "Projeto",
  PARTICIPATION: "Participação",
  OTHER: "Outra",
};

const feedbackCategoryLabels: Record<string, string> = {
  FORMATIVE: "Formativo",
  ACADEMIC: "Acadêmico",
  BEHAVIOR: "Comportamento",
  SUPPORT: "Apoio",
  GENERAL: "Geral",
};

const officialResultLabels: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  APPROVED: "Aprovado",
  RECOVERY: "Recuperação",
  FAILED_GRADE: "Reprovado por média",
  FAILED_ATTENDANCE: "Reprovado por frequência",
  FAILED: "Reprovado",
};

export default async function StudentPortalPage() {
  const session = await requireRole(["STUDENT"]);

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: session.enrollmentId || "__none__",
      status: { in: ["ACTIVE", "PENDING"] },
      class: { schoolId: session.schoolId },
    },
    include: {
      student: true,
      periodGrades: true,
      subjectResults: true,
      academicResult: true,
      class: {
        include: {
          curriculum: true,
          classSubjects: {
            orderBy: { subject: { name: "asc" } },
            include: {
              subject: true,
              teacher: true,
              scheduleSlots: {
                orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
              },
            },
          },
        },
      },
    },
  });

  if (!enrollment) {
    return (
      <div className="portal-container">
        <div className="form-alert form-alert--error">
          Sua matrícula não está disponível para acesso.
        </div>
      </div>
    );
  }

  const [periods, assessments, attendance, feedbacks] = await Promise.all([
    prisma.academicPeriod.findMany({
      where: {
        schoolId: session.schoolId,
        schoolYear: enrollment.class.schoolYear,
      },
      orderBy: { order: "asc" },
    }),
    prisma.assessment.findMany({
      where: {
        status: { in: ["PUBLISHED", "CLOSED"] },
        classSubject: {
          classId: enrollment.classId,
        },
      },
      orderBy: [
        { period: { order: "asc" } },
        { assessmentDate: "asc" },
      ],
      include: {
        period: true,
        classSubject: {
          include: {
            subject: true,
            teacher: true,
          },
        },
        scores: {
          where: { enrollmentId: enrollment.id },
          take: 1,
        },
      },
    }),
    prisma.lessonAttendance.findMany({
      where: {
        enrollmentId: enrollment.id,
        lesson: {
          status: "COMPLETED",
          classSubject: {
            classId: enrollment.classId,
          },
        },
      },
      include: {
        lesson: {
          include: {
            classSubject: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
      orderBy: {
        lesson: {
          lessonDate: "desc",
        },
      },
    }),
    prisma.academicFeedback.findMany({
      where: {
        enrollmentId: enrollment.id,
        schoolId: session.schoolId,
        visibility: { in: ["STUDENT", "BOTH"] },
        publishedAt: { not: null },
      },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const presentCount = attendance.filter(
    (item) => item.status === "PRESENT" || item.status === "LATE",
  ).length;
  const attendanceRate = attendance.length
    ? Math.round((presentCount / attendance.length) * 1000) / 10
    : null;

  const attendanceBySubjectMap = new Map<
    string,
    {
      subject: string;
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
    }
  >();

  for (const item of attendance) {
    const subject = item.lesson.classSubject.subject;
    const current =
      attendanceBySubjectMap.get(subject.id) || {
        subject: subject.name,
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };

    current.total += 1;
    if (item.status === "PRESENT") current.present += 1;
    if (item.status === "ABSENT") current.absent += 1;
    if (item.status === "LATE") current.late += 1;
    if (item.status === "EXCUSED") current.excused += 1;

    attendanceBySubjectMap.set(subject.id, current);
  }

  const attendanceBySubject = Array.from(attendanceBySubjectMap.values())
    .map((item) => ({
      ...item,
      rate: item.total
        ? Math.round(((item.present + item.late) / item.total) * 1000) / 10
        : null,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const schedule = enrollment.class.classSubjects
    .flatMap((item) =>
      item.scheduleSlots.map((slot) => ({
        id: slot.id,
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        subject: item.subject.name,
        teacher: item.teacher?.name || "Professor não definido",
      })),
    )
    .sort((a, b) =>
      a.weekday === b.weekday
        ? a.startTime.localeCompare(b.startTime)
        : a.weekday - b.weekday,
    );

  const performanceGroups = new Map<
    string,
    {
      subject: string;
      period: string;
      periodOrder: number;
      assessments: Array<{
        maxScore: number;
        weight: number;
        score: number | null;
        absent: boolean;
        excused: boolean;
      }>;
    }
  >();

  for (const assessment of assessments) {
    const key =
      assessment.classSubject.subject.id + "::" + assessment.period.id;

    if (!performanceGroups.has(key)) {
      performanceGroups.set(key, {
        subject: assessment.classSubject.subject.name,
        period: assessment.period.name,
        periodOrder: assessment.period.order,
        assessments: [],
      });
    }

    const score = assessment.scores[0];

    performanceGroups.get(key)!.assessments.push({
      maxScore: Number(assessment.maxScore),
      weight: Number(assessment.weight),
      score:
        score?.score === null || score?.score === undefined
          ? null
          : Number(score.score),
      absent: Boolean(score?.absent),
      excused: Boolean(score?.excused),
    });
  }

  const performance = Array.from(performanceGroups.values())
    .map((row) => {
      const calculated = calculatePeriodAverage(row.assessments);

      return {
        subject: row.subject,
        period: row.period,
        periodOrder: row.periodOrder,
        average: calculated.average,
        released: calculated.considered,
        total: row.assessments.length,
      };
    })
    .sort(
      (a, b) =>
        a.periodOrder - b.periodOrder ||
        a.subject.localeCompare(b.subject),
    );

  return (
    <div className="portal-container">
      <section className="student-hero">
        <div>
          <span className="eyebrow">
            ANO LETIVO {enrollment.class.schoolYear}
          </span>
          <h1>Olá, {enrollment.student.name.split(" ")[0]} 👋</h1>
          <p>
            {enrollment.class.name} • {enrollment.class.gradeLevel} •{" "}
            {enrollment.class.shift}
          </p>
        </div>
        <span
          className={
            enrollment.status === "ACTIVE"
              ? "status-chip status-chip--success"
              : "status-chip status-chip--warning"
          }
        >
          {enrollment.status === "ACTIVE"
            ? "Matrícula ativa"
            : "Matrícula pendente"}
        </span>
      </section>

      <CommunicationInbox title="Comunicados para você" />
      <PortalDocuments />
      <PrivacyPortal />
      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div>
            <span className="eyebrow">CONTA</span>
            <h2>Segurança da conta</h2>
          </div>
          <a className="button button--secondary button--small" href="/conta/seguranca">
            Dispositivos e sessões
          </a>
        </div>
      </section>

      <section className="portal-metrics">
        <article>
          <span>Turma</span>
          <strong>{enrollment.class.name}</strong>
          <small>{enrollment.class.room || "Sala não definida"}</small>
        </article>
        <article>
          <span>Grade curricular</span>
          <strong>{enrollment.class.curriculum?.name || "Não definida"}</strong>
          <small>{enrollment.class.classSubjects.length} disciplinas</small>
        </article>
        <article id="frequencia">
          <span>Frequência</span>
          <strong>
            {attendanceRate === null ? "—" : attendanceRate + "%"}
          </strong>
          <small>{attendance.length} chamada(s) lançada(s)</small>
        </article>
        <article>
          <span>Avaliações publicadas</span>
          <strong>{assessments.length}</strong>
          <small>
            {assessments.filter((item) => item.scores[0]?.score !== null).length}{" "}
            com nota lançada
          </small>
        </article>
      </section>

      <section className="portal-panel" id="frequencia-disciplinas">
        <div className="portal-panel-heading">
          <div>
            <span className="eyebrow">FREQUÊNCIA POR DISCIPLINA</span>
            <h2>Minha presença nas aulas</h2>
          </div>
        </div>

        {attendanceBySubject.length ? (
          <div className="attendance-subject-grid">
            {attendanceBySubject.map((item) => (
              <article key={item.subject}>
                <div>
                  <strong>{item.subject}</strong>
                  <span>{item.total} aula(s) contabilizada(s)</span>
                </div>
                <b>{item.rate === null ? "—" : item.rate + "%"}</b>
                <small>
                  {item.present} presente(s) • {item.late} atraso(s) •{" "}
                  {item.absent} falta(s) • {item.excused} justificada(s)
                </small>
              </article>
            ))}
          </div>
        ) : (
          <div className="portal-empty">
            Nenhuma chamada concluída foi publicada para sua matrícula.
          </div>
        )}
      </section>

      <section className="portal-panel" id="horarios">
        <div className="portal-panel-heading">
          <div>
            <span className="eyebrow">QUADRO DE HORÁRIOS</span>
            <h2>Minha semana</h2>
          </div>
        </div>

        {schedule.length ? (
          <div className="student-schedule">
            {schedule.map((slot) => (
              <article key={slot.id}>
                <span>{weekdays[slot.weekday]}</span>
                <strong>{slot.subject}</strong>
                <p>
                  {slot.startTime} – {slot.endTime}
                </p>
                <small>
                  {slot.teacher}
                  {slot.room ? " • " + slot.room : ""}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <div className="portal-empty">
            O quadro de horários ainda não foi publicado para sua turma.
          </div>
        )}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div>
            <span className="eyebrow">DISCIPLINAS</span>
            <h2>Minha grade</h2>
          </div>
        </div>

        <div className="student-subject-grid">
          {enrollment.class.classSubjects.map((item) => (
            <article key={item.id}>
              <strong>{item.subject.name}</strong>
              <span>{item.teacher?.name || "Professor não definido"}</span>
              <small>
                {item.weeklyClasses
                  ? item.weeklyClasses + " aula(s) por semana"
                  : "Carga semanal não definida"}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-panel" id="notas">
        <div className="portal-panel-heading">
          <div>
            <span className="eyebrow">DESEMPENHO</span>
            <h2>Médias parciais</h2>
          </div>
        </div>

        {performance.length ? (
          <div className="performance-grid">
            {performance.map((item) => (
              <article
                key={item.subject + item.period}
                className="performance-card"
              >
                <span>{item.period}</span>
                <strong>{item.subject}</strong>
                <b>{item.average === null ? "—" : item.average.toFixed(2)}</b>
                <small>
                  {item.released}/{item.total} avaliação(ões) com nota
                </small>
              </article>
            ))}
          </div>
        ) : (
          <div className="portal-empty">
            Ainda não há médias disponíveis para esta matrícula.
          </div>
        )}
      </section>

      <section className="portal-panel" id="boletim">
        <div className="portal-panel-heading portal-panel-heading--split">
          <div>
            <span className="eyebrow">BOLETIM OFICIAL</span>
            <h2>Fechamentos por disciplina</h2>
          </div>
          <span
            className={
              enrollment.academicResult?.status === "APPROVED"
                ? "status-chip status-chip--success"
                : enrollment.academicResult?.status === "FAILED"
                  ? "status-chip report-status--failed"
                  : "status-chip"
            }
          >
            {officialResultLabels[
              enrollment.academicResult?.status || "IN_PROGRESS"
            ]}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table official-report-table">
            <thead>
              <tr>
                <th>Disciplina</th>
                {periods.map((period) => (
                  <th key={period.id}>{period.name}</th>
                ))}
                <th>Anual</th>
                <th>Recup.</th>
                <th>Final</th>
                <th>Freq.</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {enrollment.class.classSubjects.map((classSubject) => {
                const result = enrollment.subjectResults.find(
                  (item) => item.classSubjectId === classSubject.id,
                );

                return (
                  <tr key={classSubject.id}>
                    <td>
                      <span className="enrollment-student">
                        <strong>{classSubject.subject.name}</strong>
                        <small>
                          {classSubject.teacher?.name ||
                            "Professor não definido"}
                        </small>
                      </span>
                    </td>
                    {periods.map((period) => {
                      const grade = enrollment.periodGrades.find(
                        (item) =>
                          item.classSubjectId === classSubject.id &&
                          item.periodId === period.id,
                      );

                      return (
                        <td key={period.id}>
                          {grade?.average === null ||
                          grade?.average === undefined
                            ? "—"
                            : Number(grade.average).toFixed(2)}
                        </td>
                      );
                    })}
                    <td>
                      {result?.annualAverage === null ||
                      result?.annualAverage === undefined
                        ? "—"
                        : Number(result.annualAverage).toFixed(2)}
                    </td>
                    <td>
                      {result?.recoveryScore === null ||
                      result?.recoveryScore === undefined
                        ? "—"
                        : Number(result.recoveryScore).toFixed(2)}
                    </td>
                    <td>
                      <strong>
                        {result?.finalAverage === null ||
                        result?.finalAverage === undefined
                          ? "—"
                          : Number(result.finalAverage).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      {result?.attendancePercent === null ||
                      result?.attendancePercent === undefined
                        ? "—"
                        : Number(result.attendancePercent).toFixed(1) + "%"}
                    </td>
                    <td>
                      <span
                        className={
                          result?.status === "APPROVED"
                            ? "status-chip status-chip--success"
                            : result?.status === "RECOVERY"
                              ? "status-chip status-chip--warning"
                              : result?.status?.startsWith("FAILED")
                                ? "status-chip report-status--failed"
                                : "status-chip"
                        }
                      >
                        {officialResultLabels[
                          result?.status || "IN_PROGRESS"
                        ]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {enrollment.academicResult?.decisionNote ? (
          <div className="final-decision-note">
            <strong>Observação do fechamento</strong>
            <p>{enrollment.academicResult.decisionNote}</p>
          </div>
        ) : null}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div>
            <span className="eyebrow">AVALIAÇÕES</span>
            <h2>Provas e trabalhos</h2>
          </div>
        </div>

        {assessments.length ? (
          <div className="student-assessment-list">
            {assessments.map((assessment) => {
              const score = assessment.scores[0];

              return (
                <article key={assessment.id}>
                  <div>
                    <span className="type-chip">
                      {assessmentTypeLabels[assessment.type] ||
                        assessment.type}
                    </span>
                    <strong>{assessment.title}</strong>
                    <small>
                      {assessment.classSubject.subject.name} •{" "}
                      {assessment.period.name} •{" "}
                      {new Intl.DateTimeFormat("pt-BR").format(
                        assessment.assessmentDate,
                      )}
                    </small>
                  </div>
                  <div className="student-assessment-score">
                    <span>Nota</span>
                    <strong>
                      {score?.absent
                        ? score.excused
                          ? "Falta justificada"
                          : "Faltou"
                        : score?.score !== null &&
                            score?.score !== undefined
                          ? String(score.score) +
                            " / " +
                            String(assessment.maxScore)
                          : "Aguardando"}
                    </strong>
                    {score?.feedback ? (
                      <small>{score.feedback}</small>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="portal-empty">
            Nenhuma avaliação foi publicada ainda.
          </div>
        )}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div>
            <span className="eyebrow">ACOMPANHAMENTO</span>
            <h2>Registros formativos</h2>
          </div>
        </div>

        {feedbacks.length ? (
          <div className="feedback-timeline">
            {feedbacks.map((feedback) => (
              <article key={feedback.id}>
                <span>
                  {feedbackCategoryLabels[feedback.category] ||
                    feedback.category}
                </span>
                <div>
                  <strong>{feedback.title}</strong>
                  <p>{feedback.content}</p>
                  <small>
                    {feedback.author.name} •{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                    }).format(feedback.createdAt)}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="portal-empty">
            Nenhum acompanhamento formativo foi publicado para você.
          </div>
        )}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div>
            <span className="eyebrow">CALENDÁRIO ACADÊMICO</span>
            <h2>Períodos do ano</h2>
          </div>
        </div>

        <div className="student-period-list">
          {periods.map((period) => (
            <article key={period.id}>
              <span>{period.order}</span>
              <div>
                <strong>{period.name}</strong>
                <small>
                  {new Intl.DateTimeFormat("pt-BR").format(period.startDate)} a{" "}
                  {new Intl.DateTimeFormat("pt-BR").format(period.endDate)}
                </small>
              </div>
              <b>
                {period.status === "ACTIVE"
                  ? "Em andamento"
                  : period.status === "CLOSED"
                    ? "Encerrado"
                    : "Planejado"}
              </b>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
