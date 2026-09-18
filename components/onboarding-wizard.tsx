"use client";

import { FormEvent, useEffect, useState } from "react";

type School = {
  id: string;
  name: string;
  slug: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  lifecycleStatus: string;
  onboardingCompletedAt: string | null;
  subscription: {
    status: string;
    trialEndsAt: string | null;
    plan: {
      name: string;
      maxStudents: number | null;
      maxUsers: number | null;
    };
  } | null;
};

export function OnboardingWizard() {
  const [school, setSchool] = useState<School | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/onboarding", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível carregar a implantação.");
      return;
    }

    setSchool(data.school);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          slug: String(form.get("slug") || ""),
          document: String(form.get("document") || ""),
          email: String(form.get("email") || ""),
          phone: String(form.get("phone") || ""),
          address: String(form.get("address") || ""),
          city: String(form.get("city") || ""),
          state: String(form.get("state") || ""),
          zipCode: String(form.get("zipCode") || ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível concluir a implantação.");
        return;
      }

      setMessage("Implantação concluída. O tenant já está liberado para operação.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking(false);
    }
  }

  if (!school) {
    return <div className="loading-state">Carregando implantação...</div>;
  }

  return (
    <div className="onboarding-wizard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FASE 11 • ONBOARDING</span>
          <h2>Implantação da escola</h2>
          <p>
            Confirme os dados institucionais e libere o ambiente para os demais
            usuários.
          </p>
        </div>
        <span
          className={
            school.onboardingCompletedAt
              ? "status-chip status-chip--success"
              : "status-chip status-chip--warning"
          }
        >
          {school.onboardingCompletedAt ? "Concluído" : "Pendente"}
        </span>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      <section className="panel">
        <form className="onboarding-form" onSubmit={save}>
          <label>
            Nome da instituição
            <input name="name" required defaultValue={school.name} />
          </label>
          <label>
            Identificador do tenant
            <input
              name="slug"
              defaultValue={school.slug || ""}
              placeholder="colegio-exemplo"
            />
          </label>
          <label>
            CNPJ / documento
            <input name="document" defaultValue={school.document || ""} />
          </label>
          <label>
            E-mail institucional
            <input name="email" type="email" defaultValue={school.email || ""} />
          </label>
          <label>
            Telefone
            <input name="phone" defaultValue={school.phone || ""} />
          </label>
          <label>
            CEP
            <input name="zipCode" defaultValue={school.zipCode || ""} />
          </label>
          <label className="onboarding-field--wide">
            Endereço
            <input name="address" defaultValue={school.address || ""} />
          </label>
          <label>
            Cidade
            <input name="city" defaultValue={school.city || ""} />
          </label>
          <label>
            UF
            <input name="state" maxLength={2} defaultValue={school.state || ""} />
          </label>

          <div className="onboarding-summary">
            <strong>Assinatura</strong>
            <span>
              {school.subscription
                ? school.subscription.plan.name +
                  " • " +
                  school.subscription.status
                : "Será aplicado o plano inicial disponível após a conclusão."}
            </span>
            {school.subscription?.trialEndsAt ? (
              <small>
                Trial até{" "}
                {new Intl.DateTimeFormat("pt-BR").format(
                  new Date(school.subscription.trialEndsAt),
                )}
              </small>
            ) : null}
          </div>

          <button className="button button--primary" disabled={working}>
            {working ? "Salvando..." : "Salvar e concluir implantação"}
          </button>
        </form>
      </section>
    </div>
  );
}
