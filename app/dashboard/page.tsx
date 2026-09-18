import { metrics, recentActivity, students } from "@/lib/mock-data";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const visibleMetrics =
    session.role === "ADMIN"
      ? metrics
      : session.role === "SECRETARY"
        ? metrics.filter((metric) =>
            ["Alunos ativos", "Turmas", "Frequência média"].includes(metric.label),
          )
        : session.role === "TEACHER"
          ? metrics.filter((metric) =>
              ["Turmas", "Frequência média"].includes(metric.label),
            )
          : session.role === "FINANCE"
            ? metrics.filter((metric) => metric.label === "Mensalidades em dia")
            : [];

  const showAttendance = ["ADMIN", "SECRETARY", "TEACHER"].includes(session.role);
  const showStudents = ["ADMIN", "SECRETARY"].includes(session.role);
  const visibleActivity =
    session.role === "FINANCE"
      ? recentActivity.filter((item) => item.title === "Mensalidade recebida")
      : recentActivity.filter((item) => item.title !== "Mensalidade recebida" || session.role === "ADMIN");

  if (session.role === "GUARDIAN") {
    return (
      <div className="dashboard-content">
        <section className="panel guardian-welcome">
          <span className="eyebrow">PORTAL DO RESPONSÁVEL</span>
          <h2>Seu acesso já está preparado</h2>
          <p>
            O perfil de responsável está autenticado e isolado dos módulos administrativos.
            Notas, frequência, boletos e comunicados serão conectados na fase do portal.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      {params.forbidden === "1" ? (
        <div className="form-alert form-alert--error">
          Seu perfil de {ROLE_LABELS[session.role].toLowerCase()} não possui acesso a esse módulo.
        </div>
      ) : null}

      <section className="metric-grid metric-grid--adaptive">
        {visibleMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className={"metric-dot metric-dot--" + metric.tone} />
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.detail}</span>
          </article>
        ))}
      </section>

      <section className={showAttendance ? "dashboard-grid" : "dashboard-grid dashboard-grid--single"}>
        {showAttendance ? (
          <article className="panel panel--wide">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">RESUMO SEMANAL</span>
                <h2>Presença dos alunos</h2>
              </div>
              <span className="status-chip status-chip--success">94,2% média</span>
            </div>
            <div className="attendance-chart" aria-label="Gráfico demonstrativo de frequência">
              {[78, 86, 91, 84, 96, 92, 94].map((height, index) => (
                <div className="chart-column" key={index}>
                  <div className="bar-track">
                    <span style={{ height: height + "%" }} />
                  </div>
                  <small>{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Hoje"][index]}</small>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ATIVIDADE</span>
              <h2>Últimos eventos</h2>
            </div>
          </div>
          <div className="activity-list">
            {visibleActivity.map((item) => (
              <div className="activity-item" key={item.title}>
                <span className="activity-bullet" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <small>{item.time}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {showStudents ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MATRÍCULAS</span>
              <h2>Alunos recentes</h2>
            </div>
            <a className="text-link" href="/dashboard/alunos">Ver todos →</a>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Aluno</th><th>Matrícula</th><th>Turma</th><th>Turno</th><th>Status</th></tr></thead>
              <tbody>
                {students.slice(0, 4).map((student) => (
                  <tr key={student.code}>
                    <td><strong>{student.name}</strong></td>
                    <td>{student.code}</td>
                    <td>{student.className}</td>
                    <td>{student.shift}</td>
                    <td><span className={student.status === "Ativo" ? "status-chip status-chip--success" : "status-chip status-chip--warning"}>{student.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
