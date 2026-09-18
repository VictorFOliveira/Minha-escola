import { PlatformLoginForm } from "@/components/platform-login-form";
import { getPlatformSession } from "@/lib/platform-session";
import { redirect } from "next/navigation";

export default async function SuperadminLoginPage() {
  const session = await getPlatformSession();
  if (session) redirect("/superadmin");

  return (
    <main className="platform-login-page">
      <section className="platform-login-card">
        <span className="brand-mark">ME</span>
        <span className="eyebrow">PLATAFORMA</span>
        <h1>Minha Escola Superadmin</h1>
        <p>Gestão dos tenants, planos e assinaturas do SaaS.</p>
        <PlatformLoginForm />
      </section>
    </main>
  );
}
