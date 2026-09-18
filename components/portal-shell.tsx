import { LogoutButton } from "@/components/logout-button";
import type { SessionUser } from "@/lib/session";

export function PortalShell({
  children,
  user,
  type,
}: {
  children: React.ReactNode;
  user: SessionUser;
  type: "student" | "guardian";
}) {
  const isStudent = type === "student";

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <a className="brand" href={isStudent ? "/portal/aluno" : "/portal/responsavel"}>
          <span className="brand-mark">ME</span>
          <span>
            <strong>Minha Escola</strong>
            <small>{isStudent ? "Portal do Aluno" : "Portal do Responsável"}</small>
          </span>
        </a>

        <nav className="portal-nav">
          <a href={isStudent ? "/portal/aluno" : "/portal/responsavel"}>Início</a>
          {isStudent ? <a href="#horarios">Horários</a> : null}
          {isStudent ? <a href="#notas">Notas</a> : null}
          {isStudent ? <a href="#frequencia">Frequência</a> : null}
        </nav>

        <div className="portal-user">
          <div className="avatar">
            {user.name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <strong>{user.name}</strong>
            <span>{user.schoolName}</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="portal-main">{children}</main>
    </div>
  );
}
