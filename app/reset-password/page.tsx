import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token || "";

  return (
    <main className="auth-page auth-page--simple">
      <section className="auth-main">
        <div className="auth-card">
          <a className="brand auth-card-brand" href="/">
            <span className="brand-mark">ME</span>
            <strong>Minha Escola</strong>
          </a>
          <span className="eyebrow">NOVA SENHA</span>
          <h2>Defina uma nova senha</h2>
          <p>Use pelo menos 8 caracteres e não reutilize uma senha compartilhada.</p>
          <ResetPasswordForm token={token} />
        </div>
      </section>
    </main>
  );
}
