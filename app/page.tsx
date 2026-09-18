export default function HomePage() {
  return (
    <main className="landing">
      <section className="hero">
        <nav className="landing-nav container">
          <a className="brand" href="/">
            <span className="brand-mark">ME</span>
            <span>
              <strong>Minha Escola</strong>
              <small>SaaS de gestão escolar</small>
            </span>
          </a>
          <div className="landing-links">
            <a href="#recursos">Recursos</a>
            <a href="#modulos">Módulos</a>
            <a href="#implantacao">Implantação</a>
          </div>
          <a className="button button--ghost" href="/login">Entrar no sistema</a>
        </nav>

        <div className="hero-grid container">
          <div className="hero-copy">
            <span className="pill">NOVO SaaS • Minha Escola</span>
            <h1>Toda a escola em um único lugar.</h1>
            <p>
              Uma plataforma SaaS para escolas centralizarem alunos, responsáveis,
              professores, funcionários, turmas, frequência, financeiro e comunicação.
            </p>
            <div className="hero-actions">
              <a className="button button--primary" href="/login">Acessar Minha Escola</a>
              <a className="button button--secondary" href="#recursos">Conhecer o SaaS</a>
            </div>
            <div className="hero-trust">
              <span>✓ Multi-escola</span>
              <span>✓ Acesso por perfil</span>
              <span>✓ PostgreSQL</span>
              <span>✓ Evolução contínua</span>
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
          <span className="eyebrow">SAAS DE GESTÃO ESCOLAR</span>
          <h2>Da secretaria ao financeiro, com uma única base de dados</h2>
          <p>O Minha Escola está sendo construído por fases, com módulos integrados desde a arquitetura.</p>
        </div>
        <div className="feature-grid">
          {[
            ["01", "Alunos e responsáveis", "Cadastros reais, contatos, documentos e vínculos familiares."],
            ["02", "Professores e equipe", "Gestão de docentes, funcionários, funções e situação cadastral."],
            ["03", "Turmas e matrículas", "Turmas reais, vagas, matrícula, rematrícula e histórico por ano letivo."],
            ["04", "Financeiro", "Base para mensalidades, recebimentos e inadimplência."],
            ["05", "Acesso por perfil", "Administrador, coordenação, secretaria, professor, financeiro, aluno e responsável."],
            ["06", "Multi-escola", "Arquitetura SaaS preparada para atender várias instituições."],
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
            <span className="eyebrow">EM CONSTRUÇÃO CONTÍNUA</span>
            <h2>Um SaaS que cresce sem precisar recomeçar.</h2>
          </div>
          <div className="check-list">
            <p><strong>Fase 1 concluída</strong><span>Fundação, dashboard, API e estrutura multi-escola.</span></p>
            <p><strong>Fase 2 concluída</strong><span>Login, sessões, recuperação e controle por perfil.</span></p>
            <p><strong>Fase 3 concluída</strong><span>Cadastros reais de escola, alunos, responsáveis, professores e funcionários.</span></p>
            <p><strong>Fase 4 concluída</strong><span>Turmas reais, matrículas, rematrículas, capacidade e histórico escolar.</span></p>
            <p><strong>Fase 5 concluída</strong><span>Disciplinas, períodos, grade curricular, horários, avaliações, notas e portal acadêmico do aluno.</span></p>
            <p><strong>Próxima fase</strong><span>Frequência por disciplina e diário completo do professor.</span></p>
          </div>
        </div>
      </section>

      <section className="cta-section container" id="implantacao">
        <div>
          <span className="eyebrow eyebrow--light">MINHA ESCOLA SaaS</span>
          <h2>A gestão escolar saindo da demonstração e virando operação real.</h2>
          <p>Cadastros, autenticação e dados por instituição já fazem parte da base do produto.</p>
        </div>
        <a className="button button--light" href="/login">Entrar no sistema →</a>
      </section>

      <footer className="footer container">
        <div className="brand">
          <span className="brand-mark">ME</span>
          <strong>Minha Escola SaaS</strong>
        </div>
        <span>© 2026 Minha Escola</span>
      </footer>
    </main>
  );
}
