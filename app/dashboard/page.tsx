import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { calculateAttendancePercent } from "@/lib/grade-calculations";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

const attendanceLabels = {
  PRESENT: "Presenças",
  LATE: "Atrasos",
  ABSENT: "Faltas",
  EXCUSED: "Justificadas",
} as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  if (session.role === "STUDENT") {
    redirect("/portal/aluno");
  }

  if (session.role === "GUARDIAN") {
    redirect("/portal/responsavel");
  }

  const latestClass = await prisma.classGroup.findFirst({
    where: { schoolId: session.schoolId },
    orderBy: [{ schoolYear: "desc" }, { createdAt: "desc" }],
    select: { schoolYear: true },
  });

  const schoolYear = latestClass?.schoolYear ?? new Date().getFullYear();
  const startOfMonth = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  );

  const showStudents = ["ADMIN", "SECRETARY"].includes(session.role);
  const showAttendance = [
    "ADMIN",
    "COORDINATOR",
    "SECRETARY",
    "TEACHER",
  ].includes(session.role);
  const showFinance = ["ADMIN", "FINANCE"].includes(session.role);
  const showClasses = [
    "ADMIN",
    "COORDINATOR",
    "SECRETARY",
    "TEACHER",
  ].includes(session.role);

  const attendanceWhere: Prisma.LessonAttendanceWhereInput =
    session.role === "TEACHER"
      ? {
          lesson: {
            status: "COMPLETED",
            classSubject: {
              teacherId: session.teacherId || "__teacher_without_link__",
              class: { schoolId: session.schoolId },
            },
          },
        }
      : {
          lesson: {
            status: "COMPLETED",
            classSubject: {
              class: { schoolId: session.schoolId },
            },
          },
        };

  const [
    activeStudents,
    newStudentsThisMonth,
    schoolClasses,
    teacherClasses,
    attendanceGroups,
    recentStudents,
    chargeCount,
    onTimeChargeCount,
    overdueChargeCount,
    receivable,
  ] = await Promise.all([
    showStudents
      ? prisma.student.count({
          where: { schoolId: session.schoolId, status: "ACTIVE" },
        })
      : Promise.resolve(0),
    showStudents
      ? prisma.student.count({
          where: {
            schoolId: session.schoolId,
            status: "ACTIVE",
            createdAt: { gte: startOfMonth },
          },
        })
      : Promise.resolve(0),
    showClasses && session.role !== "TEACHER"
      ? prisma.classGroup.count({
          where: { schoolId: session.schoolId, schoolYear },
        })
      : Promise.resolve(0),
    showClasses && session.role === "TEACHER"
      ? prisma.classSubject.findMany({
          where: {
            teacherId: session.teacherId || "__teacher_without_link__",
            class: {
              schoolId: session.schoolId,
              schoolYear,
            },
          },
          distinct: ["classId"],
          select: { classId: true },
        })
      : Promise.resolve([]),
    showAttendance
      ? prisma.lessonAttendance.groupBy({
          by: ["status"],
          where: attendanceWhere,
          _count: { _all: true },
        })
      : Promise.resolve([]),
    showStudents
      ? prisma.student.findMany({
          where: {
            schoolId: session.schoolId,
            status: "ACTIVE",
          },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: {
            id: true,
            name: true,
            registration: true,
            enrollments: {
              where: { status: { in: ["ACTIVE", "PENDING"] } },
              orderBy: { startedAt: "desc" },
              take: 1,
              select: {
                status: true,
                class: {
                  select: {
                    name: true,
                    shift: true,
                    schoolYear: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    showFinance
      ? prisma.charge.count({
          where: {
            schoolId: session.schoolId,
            status: { in: ["PENDING", "PARTIAL", "PAID", "OVERDUE"] },
          },
        })
      : Promise.resolve(0),
    showFinance
      ? prisma.charge.count({
          where: {
            schoolId: session.schoolId,
            status: { in: ["PENDING", "PAID"] },
          },
        })
      : Promise.resolve(0),
    showFinance
      ? prisma.charge.count({
          where: {
            schoolId: session.schoolId,
            status: "OVERDUE",
          },
        })
      : Promise.resolve(0),
    showFinance
      ? prisma.charge.aggregate({
          where: {
            schoolId: session.schoolId,
            status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          },
          _sum: {
            amount: true,
            paidAmount: true,
          },
        })
      : Promise.resolve({
          _sum: { amount: null, paidAmount: null },
        }),
  ]);

  const attendanceCounts = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
  };

  for (const item of attendanceGroups) {
    const count = item._count._all;
    if (item.status === "PRESENT") attendanceCounts.present = count;
    if (item.status === "LATE") attendanceCounts.late = count;
    if (item.status === "ABSENT") attendanceCounts.absent = count;
    if (item.status === "EXCUSED") attendanceCounts.excused = count;
  }

  const attendanceTotal =
    attendanceCounts.present +
    attendanceCounts.late +
    attendanceCounts.absent +
    attendanceCounts.excused;

  const attendancePercent = calculateAttendancePercent(attendanceCounts);
  const receivableAmount = Math.max(
    0,
    Number(receivable._sum.amount || 0) -
      Number(receivable._sum.paidAmount || 0),
  );
  const onTimePercent =
    chargeCount > 0 ? Math.round((onTimeChargeCount / chargeCount) * 1000) / 10 : null;

  const metrics: Array<{
    label: string;
    value: string;
    detail: string;
    tone: string;
  }> = [];

  if (showStudents) {
    metrics.push({
      label: "Alunos ativos",
      value: activeStudents.toLocaleString("pt-BR"),
      detail:
        newStudentsThisMonth > 0
          ? `+${newStudentsThisMonth} neste mês`
          : "Nenhum novo cadastro neste mês",
      tone: "blue",
    });
  }

  if (showClasses) {
    const classCount =
      session.role === "TEACHER" ? teacherClasses.length : schoolClasses;

    metrics.push({
      label: session.role === "TEACHER" ? "Minhas turmas" : "Turmas",
      value: classCount.toLocaleString("pt-BR"),
      detail: `Ano letivo ${schoolYear}`,
      tone: "violet",
    });
  }

  if (showAttendance) {
    metrics.push({
      label: "Frequência média",
      value:
        attendancePercent === null
          ? "—"
          : attendancePercent.toLocaleString("pt-BR", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }) + "%",
      detail:
        attendanceTotal > 0
          ? `${attendanceTotal.toLocaleString("pt-BR")} registros concluídos`
          : "Sem chamadas concluídas",
      tone: "green",
    });
  }

  if (showFinance) {
    metrics.push({
      label: "Mensalidades em dia",
      value:
        onTimePercent === null
          ? "—"
          : onTimePercent.toLocaleString("pt-BR", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }) + "%",
      detail:
        overdueChargeCount > 0
          ? `${overdueChargeCount} vencida(s) • ${money(receivableAmount)} a receber`
          : `${money(receivableAmount)} a receber`,
      tone: "orange",
    });
  }

  const attendanceBars = [
    { key: "PRESENT" as const, count: attendanceCounts.present },
    { key: "LATE" as const, count: attendanceCounts.late },
    { key: "ABSENT" as const, count: attendanceCounts.absent },
    { key: "EXCUSED" as const, count: attendanceCounts.excused },
  ];

  return (
    <div className="dashboard-content">
      {params.forbidden === "1" ? (
        <div className="form-alert form-alert--error">
          Seu perfil de {ROLE_LABELS[session.role].toLowerCase()} não possui acesso a esse módulo.
        </div>
      ) : null}

      <section className="metric-grid metric-grid--adaptive">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className={"metric-dot metric-dot--" + metric.tone} />
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.detail}</span>
          </article>
        ))}
      </section>

      {showAttendance ? (
        <section className="dashboard-grid dashboard-grid--single">
          <article className="panel panel--wide">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">FREQUÊNCIA REAL</span>
                <h2>Registros de aulas concluídas</h2>
              </div>
              <span className="status-chip status-chip--success">
                {attendancePercent === null
                  ? "Sem dados"
                  : attendancePercent.toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }) + "% frequência"}
              </span>
            </div>

            {attendanceTotal > 0 ? (
              <div
                className="attendance-chart"
                aria-label="Distribuição real dos registros de frequência"
              >
                {attendanceBars.map((item) => {
                  const percentage = Math.round(
                    (item.count / attendanceTotal) * 100,
                  );

                  return (
                    <div className="chart-column" key={item.key}>
                      <div className="bar-track">
                        <span style={{ height: Math.max(percentage, item.count ? 4 : 0) + "%" }} />
                      </div>
                      <small>
                        {attendanceLabels[item.key]} {percentage}%
                      </small>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">
                Ainda não há registros de frequência em aulas concluídas.
              </p>
            )}
          </article>
        </section>
      ) : null}

      {showStudents ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CADASTROS REAIS</span>
              <h2>Alunos recentes</h2>
            </div>
            <a className="text-link" href="/dashboard/alunos">
              Ver todos →
            </a>
          </div>

          {recentStudents.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Matrícula</th>
                    <th>Turma</th>
                    <th>Turno</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStudents.map((student) => {
                    const enrollment = student.enrollments[0];

                    return (
                      <tr key={student.id}>
                        <td>
                          <strong>{student.name}</strong>
                        </td>
                        <td>{student.registration}</td>
                        <td>
                          {enrollment
                            ? `${enrollment.class.name} • ${enrollment.class.schoolYear}`
                            : "Sem matrícula"}
                        </td>
                        <td>{enrollment?.class.shift || "—"}</td>
                        <td>
                          <span
                            className={
                              enrollment?.status === "ACTIVE"
                                ? "status-chip status-chip--success"
                                : enrollment?.status === "PENDING"
                                  ? "status-chip status-chip--warning"
                                  : "status-chip"
                            }
                          >
                            {enrollment?.status === "ACTIVE"
                              ? "Ativo"
                              : enrollment?.status === "PENDING"
                                ? "Pendente"
                                : "Sem matrícula"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">Nenhum aluno ativo cadastrado.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
