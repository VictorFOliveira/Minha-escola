import { attendance } from "@/lib/mock-data";

export default function AttendancePage() {
  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACADÊMICO</span>
          <h2>Frequência</h2>
          <p>Acompanhamento diário de presença por turma.</p>
        </div>
        <button className="button button--primary">Lançar frequência</button>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">HOJE • 17 SET 2026</span>
            <h2>Resumo do dia</h2>
          </div>
          <span className="status-chip status-chip--success">94,8% presença</span>
        </div>
        <div className="attendance-list">
          {attendance.map((row) => (
            <div className="attendance-row" key={row.className}>
              <strong>{row.className}</strong>
              <div className="attendance-progress"><span style={{ width: row.rate }} /></div>
              <span>{row.present} presentes</span>
              <span>{row.absent} faltas</span>
              <b>{row.rate.replace(".", ",")}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
