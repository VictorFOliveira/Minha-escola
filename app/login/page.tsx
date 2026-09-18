import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="auth-page">
      <section className="auth-side">
        <a className="brand auth-brand" href="/">
          <span className="brand-mark">ME</span>
          <span>
            <strong>Minha Escola</strong>
            <small>Gestão escolar</small>
          </span>
        </a>

        <div className="auth-side-copy">
          <span className="eyebrow eyebrow--light">AMBIENTE SEGURO</span>
          <h1>A rotina da escola começa aqui.</h1>
          <p>
            Acesse alunos, turmas, frequência e financeiro de acordo com o seu
            perfil de acesso.
          </p>
          <div className="auth-feature-list">
            <span>✓ Sessão segura por cookie HttpOnly</span>
            <span>✓ Permissões por função</span>
            <span>✓ Dados separados por escola</span>
          </div>
        </div>
      </section>

      <section className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">ACESSO</span>
          <h2>Bem-vindo de volta</h2>
          <p>Entre com as credenciais cadastradas pela sua escola.</p>
          <LoginForm />
          <div className="auth-footer-link">
            <a href="/">← Voltar ao site</a>
          </div>
        </div>
      </section>
    </main>
  );
}
