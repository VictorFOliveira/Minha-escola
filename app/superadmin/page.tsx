import { SuperadminDashboard } from "@/components/superadmin-dashboard";
import { requirePlatformSession } from "@/lib/platform-session";

export default async function SuperadminPage() {
  const session = await requirePlatformSession();

  return (
    <main className="superadmin-page">
      <header className="superadmin-topbar">
        <div>
          <span className="eyebrow">MINHA ESCOLA • PLATAFORMA</span>
          <h1>Superadmin</h1>
        </div>
        <div className="superadmin-user">
          <a className="button button--secondary button--small" href="/superadmin/status">
            Status
          </a>
          <a className="button button--secondary button--small" href="/superadmin/seguranca">
            Segurança
          </a>
          <span>{session.name}</span>
          <form action="/api/platform/auth/logout" method="post">
            <button className="button button--secondary button--small">
              Sair
            </button>
          </form>
        </div>
      </header>
      <SuperadminDashboard />
    </main>
  );
}
