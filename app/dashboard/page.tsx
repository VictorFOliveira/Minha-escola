import { metrics, recentActivity, students } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="dashboard-content">
      <section className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className={"metric-dot metric-dot--" + metric.tone} />
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.detail}</span>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
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

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ATIVIDADE</span>
              <h2>Últimos eventos</h2>
            </div>
          </div>
          <div className="activity-list">
            {recentActivity.map((item) => (
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
    </div>
  );
}
