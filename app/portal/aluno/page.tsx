import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

const weekdays: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
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

  const [periods, grades, attendance] = await Promise.all([
    prisma.academicPeriod.findMany({
      where: {
        schoolId: session.schoolId,
        schoolYear: enrollment.class.schoolYear,
      },
      orderBy: { order: "asc" },
    }),
    prisma.grade.findMany({
      where: {
        studentId: enrollment.studentId,
        classId: enrollment.classId,
      },
      orderBy: [{ term: "asc" }, { subject: "asc" }],
    }),
    prisma.attendance.findMany({
      where: {
        studentId: enrollment.studentId,
        classId: enrollment.classId,
      },
      select: { present: true },
    }),
  ]);

  const presentCount = attendance.filter((item) => item.present).length;
  const attendanceRate = attendance.length
    ? Math.round((presentCount / attendance.length) * 1000) / 10
    : null;

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

  return (
    <div className="portal-container">
      <section className="student-hero">
        <div>
          <span className="eyebrow">ANO LETIVO {enrollment.class.schoolYear}</span>
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
          {enrollment.status === "ACTIVE" ? "Matrícula ativa" : "Matrícula pendente"}
        </span>
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
          <strong>{attendanceRate === null ? "—" : attendanceRate + "%"}</strong>
          <small>{attendance.length} chamada(s) lançada(s)</small>
        </article>
        <article>
          <span>Períodos</span>
          <strong>{periods.length}</strong>
          <small>{periods.find((item) => item.status === "ACTIVE")?.name || "Nenhum período ativo"}</small>
        </article>
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
                <p>{slot.startTime} – {slot.endTime}</p>
                <small>{slot.teacher}{slot.room ? " • " + slot.room : ""}</small>
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
            <h2>Notas lançadas</h2>
          </div>
        </div>

        {grades.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th>Período</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((grade) => (
                  <tr key={grade.id}>
                    <td><strong>{grade.subject}</strong></td>
                    <td>{grade.term}</td>
                    <td>{String(grade.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="portal-empty">
            Nenhuma nota foi lançada para esta matrícula ainda.
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
              <b>{period.status === "ACTIVE" ? "Em andamento" : period.status === "CLOSED" ? "Encerrado" : "Planejado"}</b>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
