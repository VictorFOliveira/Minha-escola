export default function HomePage() {
  return (
    <main className="landing">
      <section className="hero">
        <nav className="landing-nav container">
          <a className="brand" href="/">
            <span className="brand-mark">ME</span>
            <span>
              <strong>Minha Escola</strong>
              <small>Gestão escolar</small>
            </span>
          </a>
          <div className="landing-links">
            <a href="#recursos">Recursos</a>
            <a href="#modulos">Módulos</a>
            <a href="#implantacao">Implantação</a>
          </div>
          <a className="button button--ghost" href="/dashboard">Entrar no painel</a>
        </nav>

        <div className="hero-grid container">
          <div className="hero-copy">
            <span className="pill">Gestão escolar sem planilhas espalhadas</span>
            <h1>Toda a escola em um único lugar.</h1>
            <p>
              Matrículas, turmas, frequência, notas, financeiro e comunicação
              em uma plataforma simples para secretaria, professores e direção.
            </p>
            <div className="hero-actions">
              <a className="button button--primary" href="/dashboard">Explorar demonstração</a>
              <a className="button button--secondary" href="#recursos">Ver recursos</a>
            </div>
            <div className="hero-trust">
              <span>✓ Interface responsiva</span>
              <span>✓ Preparado para PostgreSQL</span>
              <span>✓ Base multi-escola</span>
            </div>
          </div>

          <div className="hero-preview" aria-label="Prévia do painel Minha Escola">
            <div className="preview-bar"><span /><span /><span /></div>
            <div className="preview-shell">
              <div className="preview-sidebar">
                <div className="preview-logo">ME</div>
                <i /><i /><i /><i />
              </div>
              <div className="preview-content">
                <div className="preview-title" />
                <div className="preview-cards"><b /><b /><b /></div>
                <div className="preview-chart">
                  <div className="chart-line">
                    <span style={{ height: "32%" }} />
                    <span style={{ height: "48%" }} />
                    <span style={{ height: "43%" }} />
                    <span style={{ height: "70%" }} />
                    <span style={{ height: "62%" }} />
                    <span style={{ height: "82%" }} />
                    <span style={{ height: "76%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section container" id="recursos">
        <div className="section-heading">
          <span className="eyebrow">PRIMEIRA FASE</span>
          <h2>A base para administrar a rotina escolar</h2>
          <p>Os módulos essenciais já organizados para evoluir para uma operação completa.</p>
        </div>
        <div className="feature-grid">
          {[
            ["01", "Alunos e matrículas", "Cadastro centralizado, situação da matrícula, turma e turno."],
            ["02", "Turmas", "Organização de séries, salas, professores e capacidade das turmas."],
            ["03", "Frequência", "Visão diária de presença, faltas e percentual por turma."],
            ["04", "Financeiro", "Indicadores de recebimento, mensalidades e inadimplência."],
            ["05", "Desempenho", "Estrutura preparada para notas, avaliações e boletins."],
            ["06", "Comunicação", "Base para avisos, responsáveis e notificações futuras."],
          ].map(([number, title, description]) => (
            <article className="feature-card" key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--soft" id="modulos">
        <div className="container split-section">
          <div>
            <span className="eyebrow">ARQUITETURA</span>
            <h2>Pronto para crescer sem refazer tudo depois.</h2>
          </div>
          <div className="check-list">
            <p><strong>Next.js + TypeScript</strong><span>Frontend e API no mesmo projeto.</span></p>
            <p><strong>PostgreSQL + Prisma</strong><span>Modelo relacional preparado para produção.</span></p>
            <p><strong>Multi-escola</strong><span>Dados associados à instituição desde a modelagem inicial.</span></p>
            <p><strong>CI no GitHub</strong><span>Build e validação automática a cada alteração.</span></p>
          </div>
        </div>
      </section>

      <section className="cta-section container" id="implantacao">
        <div>
          <span className="eyebrow eyebrow--light">MINHA ESCOLA</span>
          <h2>O primeiro núcleo do sistema já está de pé.</h2>
          <p>Acesse o painel demonstrativo para navegar pelos módulos iniciais.</p>
        </div>
        <a className="button button--light" href="/dashboard">Abrir painel →</a>
      </section>

      <footer className="footer container">
        <div className="brand">
          <span className="brand-mark">ME</span>
          <strong>Minha Escola</strong>
        </div>
        <span>© 2026 Minha Escola</span>
      </footer>
    </main>
  );
}
