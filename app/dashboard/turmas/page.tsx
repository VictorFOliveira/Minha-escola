import { classes } from "@/lib/mock-data";

export default function ClassesPage() {
  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACADÊMICO</span>
          <h2>Turmas</h2>
          <p>Organize séries, professores, salas e capacidade.</p>
        </div>
        <button className="button button--primary">+ Nova turma</button>
      </div>

      <section className="class-grid">
        {classes.map((item) => (
          <article className="class-card" key={item.name}>
            <div className="class-card-top">
              <span className="class-badge">{item.name}</span>
              <button className="more-button">•••</button>
            </div>
            <h3>{item.teacher}</h3>
            <p>Professor responsável</p>
            <div className="class-meta">
              <span><strong>{item.students}</strong> alunos</span>
              <span><strong>{item.room}</strong> sala</span>
            </div>
            <div className="class-footer">
              <span>{item.shift}</span>
              <a href="/dashboard/frequencia">Abrir turma →</a>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
