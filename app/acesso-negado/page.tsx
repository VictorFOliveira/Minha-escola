import { homePathForRole } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export default async function AccessDeniedPage() {
  const session = await requireSession();

  return (
    <main className="access-denied-page">
      <div className="access-denied-card">
        <span>403</span>
        <h1>Acesso não permitido</h1>
        <p>
          Seu perfil não possui permissão para abrir este módulo.
        </p>
        <a className="button button--primary" href={homePathForRole(session.role)}>
          Voltar ao meu ambiente
        </a>
      </div>
    </main>
  );
}
