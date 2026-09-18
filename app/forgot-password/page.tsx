import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page auth-page--simple">
      <section className="auth-main">
        <div className="auth-card">
          <a className="brand auth-card-brand" href="/">
            <span className="brand-mark">ME</span>
            <strong>Minha Escola</strong>
          </a>
          <span className="eyebrow">RECUPERAÇÃO</span>
          <h2>Recuperar acesso</h2>
          <p>
            Informe o e-mail da conta. O token expira automaticamente em 30 minutos.
          </p>
          <ForgotPasswordForm />
          <div className="auth-footer-link">
            <a href="/login">← Voltar ao login</a>
          </div>
        </div>
      </section>
    </main>
  );
}
