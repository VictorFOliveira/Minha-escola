import { students } from "@/lib/mock-data";

export default function StudentsPage() {
  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SECRETARIA</span>
          <h2>Alunos</h2>
          <p>Cadastros, matrículas e situação acadêmica.</p>
        </div>
        <button className="button button--primary">+ Cadastrar aluno</button>
      </div>

      <section className="panel">
        <div className="toolbar">
          <div className="search-box">⌕ <span>Buscar por nome ou matrícula...</span></div>
          <button className="button button--secondary button--small">Filtros</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Aluno</th><th>Matrícula</th><th>Turma</th><th>Turno</th><th>Status</th><th /></tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.code}>
                  <td><div className="student-cell"><span className="avatar avatar--small">{student.name.split(" ").slice(0,2).map((n) => n[0]).join("")}</span><strong>{student.name}</strong></div></td>
                  <td>{student.code}</td>
                  <td>{student.className}</td>
                  <td>{student.shift}</td>
                  <td><span className={student.status === "Ativo" ? "status-chip status-chip--success" : "status-chip status-chip--warning"}>{student.status}</span></td>
                  <td><button className="more-button">•••</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
