import { LogoutButton } from "@/components/logout-button";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

const navItems: Array<{
  href: string;
  label: string;
  icon: string;
  roles: AppRole[];
}> = [
  { href: "/dashboard", label: "Visão geral", icon: "◫", roles: ["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER", "FINANCE"] },
  { href: "/dashboard/alunos", label: "Alunos", icon: "◎", roles: ["ADMIN", "SECRETARY"] },
  { href: "/dashboard/matriculas", label: "Matrículas", icon: "▣", roles: ["ADMIN", "SECRETARY"] },
  { href: "/dashboard/responsaveis", label: "Responsáveis", icon: "♧", roles: ["ADMIN", "SECRETARY"] },
  { href: "/dashboard/professores", label: "Professores", icon: "♙", roles: ["ADMIN", "SECRETARY"] },
  { href: "/dashboard/funcionarios", label: "Funcionários", icon: "♢", roles: ["ADMIN"] },
  { href: "/dashboard/turmas", label: "Turmas", icon: "▦", roles: ["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER"] },
  { href: "/dashboard/academico", label: "Acadêmico", icon: "▤", roles: ["ADMIN", "COORDINATOR", "SECRETARY"] },
  { href: "/dashboard/avaliacoes", label: "Avaliações", icon: "✎", roles: ["ADMIN", "COORDINATOR", "TEACHER"] },
  { href: "/dashboard/frequencia", label: "Frequência", icon: "✓", roles: ["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER"] },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: "$", roles: ["ADMIN", "FINANCE"] },
  { href: "/dashboard/usuarios", label: "Usuários", icon: "⚙", roles: ["ADMIN"] },
  { href: "/dashboard/escola", label: "Escola", icon: "⌂", roles: ["ADMIN"] },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const allowedItems = navItems.filter((item) => item.roles.includes(user.role));
  const canCreateStudent = user.role === "ADMIN" || user.role === "SECRETARY";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand brand--sidebar" href="/">
          <span className="brand-mark">ME</span>
          <span>
            <strong>Minha Escola</strong>
            <small>SaaS de gestão escolar</small>
          </span>
        </a>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          <p className="nav-label">GESTÃO</p>
          {allowedItems.map((item) => (
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
          <div className="avatar">{initials(user.name) || "US"}</div>
          <div className="sidebar-user-copy">
            <strong>{user.name}</strong>
            <span>{ROLE_LABELS[user.role]}</span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">{user.schoolName.toUpperCase()}</p>
            <h1>Olá, {user.name.split(" ")[0]} 👋</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notificações">🔔</button>
            {canCreateStudent ? (
              <a className="button button--primary button--small" href="/dashboard/alunos">
                + Novo aluno
              </a>
            ) : null}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
