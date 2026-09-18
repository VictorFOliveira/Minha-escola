const navItems = [
  { href: "/dashboard", label: "Visão geral", icon: "◫" },
  { href: "/dashboard/alunos", label: "Alunos", icon: "◎" },
  { href: "/dashboard/turmas", label: "Turmas", icon: "▦" },
  { href: "/dashboard/frequencia", label: "Frequência", icon: "✓" },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: "$" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand brand--sidebar" href="/">
          <span className="brand-mark">ME</span>
          <span>
            <strong>Minha Escola</strong>
            <small>Gestão escolar</small>
          </span>
        </a>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          <p className="nav-label">GESTÃO</p>
          {navItems.map((item) => (
            <a key={item.href} className="nav-item" href={item.href}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-card">
          <strong>Ano letivo 2026</strong>
          <span>2º semestre em andamento</span>
          <div className="progress-track">
            <div className="progress-value" style={{ width: "62%" }} />
          </div>
        </div>

        <div className="sidebar-user">
          <div className="avatar">AD</div>
          <div>
            <strong>Administrador</strong>
            <span>Secretaria</span>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">COLÉGIO DEMONSTRAÇÃO</p>
            <h1>Olá, bem-vindo 👋</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notificações">🔔</button>
            <a className="button button--primary button--small" href="/dashboard/alunos">
              + Novo aluno
            </a>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
