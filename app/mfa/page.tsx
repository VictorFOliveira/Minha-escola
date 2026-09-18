import { MfaChallenge } from "@/components/mfa-challenge";

export default function MfaPage() {
  return (
    <main className="auth-page">
      <section className="auth-side">
        <a className="brand auth-brand" href="/">
          <span className="brand-mark">ME</span>
          <span>
            <strong>Minha Escola</strong>
            <small>Segurança da conta</small>
          </span>
        </a>
        <div className="auth-side-copy">
          <span className="eyebrow eyebrow--light">MFA</span>
          <h1>Uma segunda barreira para contas sensíveis.</h1>
          <p>
            Administradores usam autenticação em duas etapas antes da sessão
            ser criada.
          </p>
        </div>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <MfaChallenge platform={false} />
        </div>
      </section>
    </main>
  );
}
