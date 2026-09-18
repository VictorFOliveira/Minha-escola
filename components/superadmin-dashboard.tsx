"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: string | number;
  annualPrice: string | number | null;
  maxStudents: number | null;
  maxUsers: number | null;
  active: boolean;
  _count: { subscriptions: number };
};

type School = {
  id: string;
  name: string;
  slug: string | null;
  lifecycleStatus: string;
  onboardingCompletedAt: string | null;
  createdAt: string;
  subscription: {
    id: string;
    status: string;
    provider: "MANUAL" | "ASAAS" | "EXTERNAL";
    billingInterval: "MONTHLY" | "ANNUAL";
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    nextBillingAt: string | null;
    plan: Plan;
    invoices: Array<{
      id: string;
      status: string;
      amount: string | number;
      dueDate: string;
      invoiceUrl: string | null;
    }>;
  } | null;
  _count: {
    students: number;
    users: number;
    classes: number;
  };
};

function money(value: string | number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export function SuperadminDashboard() {
  const [schools, setSchools] = useState<School[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [createSchoolOpen, setCreateSchoolOpen] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");

    try {
      const [schoolsResponse, plansResponse] = await Promise.all([
        fetch("/api/platform/schools", { cache: "no-store" }),
        fetch("/api/platform/plans", { cache: "no-store" }),
      ]);
      const [schoolsData, plansData] = await Promise.all([
        schoolsResponse.json(),
        plansResponse.json(),
      ]);

      if (!schoolsResponse.ok) {
        setError(schoolsData.error || "Não foi possível carregar os tenants.");
        return;
      }

      if (!plansResponse.ok) {
        setError(plansData.error || "Não foi possível carregar os planos.");
        return;
      }

      setSchools(schoolsData.schools || []);
      setPlans(plansData.plans || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const metrics = useMemo(() => {
    return {
      schools: schools.length,
      active: schools.filter((item) =>
        ["ACTIVE", "TRIAL"].includes(item.lifecycleStatus),
      ).length,
      students: schools.reduce(
        (sum, item) => sum + item._count.students,
        0,
      ),
      mrr: schools.reduce((sum, item) => {
        if (!item.subscription) return sum;
        if (!["ACTIVE", "TRIAL"].includes(item.subscription.status)) {
          return sum;
        }
        return sum + Number(item.subscription.plan.monthlyPrice);
      }, 0),
    };
  }, [schools]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking("plan");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/platform/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: String(form.get("code") || ""),
          name: String(form.get("name") || ""),
          description: String(form.get("description") || ""),
          monthlyPrice: String(form.get("monthlyPrice") || ""),
          annualPrice: String(form.get("annualPrice") || ""),
          maxStudents: String(form.get("maxStudents") || ""),
          maxUsers: String(form.get("maxUsers") || ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível criar o plano.");
        return;
      }

      event.currentTarget.reset();
      setCreatePlanOpen(false);
      setMessage("Plano criado.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function createSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking("school");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/platform/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          slug: String(form.get("slug") || ""),
          document: String(form.get("document") || ""),
          adminName: String(form.get("adminName") || ""),
          adminEmail: String(form.get("adminEmail") || ""),
          adminPassword: String(form.get("adminPassword") || ""),
          planId: String(form.get("planId") || ""),
          provider: String(form.get("provider") || "MANUAL"),
          billingInterval: String(form.get("billingInterval") || "MONTHLY"),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível criar o tenant.");
        return;
      }

      event.currentTarget.reset();
      setCreateSchoolOpen(false);
      setMessage("Tenant criado. O administrador já pode concluir o onboarding.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function updateSchool(
    school: School,
    input: {
      lifecycleStatus?: string;
      subscriptionStatus?: string;
      planId?: string;
      provider?: string;
      billingInterval?: string;
    },
  ) {
    setWorking("school:" + school.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/platform/schools/" + school.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível atualizar o tenant.");
        return;
      }

      setMessage("Tenant atualizado.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function issueInvoice(school: School) {
    setWorking("invoice:" + school.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/platform/schools/" + school.id + "/billing/issue",
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível emitir a cobrança.");
        return;
      }

      setMessage(
        data.invoice
          ? "Cobrança da plataforma emitida."
          : "Nenhuma cobrança precisava ser emitida.",
      );
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="superadmin-dashboard">
      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      <section className="superadmin-metrics">
        <article>
          <span>Tenants</span>
          <strong>{metrics.schools}</strong>
        </article>
        <article>
          <span>Ativos / trial</span>
          <strong>{metrics.active}</strong>
        </article>
        <article>
          <span>Alunos na plataforma</span>
          <strong>{metrics.students}</strong>
        </article>
        <article>
          <span>MRR nominal</span>
          <strong>{money(metrics.mrr)}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PLANOS DA PLATAFORMA</span>
            <h2>Assinaturas SaaS</h2>
          </div>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => setCreatePlanOpen((value) => !value)}
          >
            + Plano
          </button>
        </div>

        {createPlanOpen ? (
          <form className="platform-plan-form" onSubmit={createPlan}>
            <label>
              Código
              <input name="code" required placeholder="STARTER" />
            </label>
            <label>
              Nome
              <input name="name" required placeholder="Starter" />
            </label>
            <label>
              Mensal
              <input
                name="monthlyPrice"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </label>
            <label>
              Anual
              <input name="annualPrice" type="number" min="0" step="0.01" />
            </label>
            <label>
              Máx. alunos
              <input name="maxStudents" type="number" min="1" />
            </label>
            <label>
              Máx. usuários
              <input name="maxUsers" type="number" min="1" />
            </label>
            <label className="platform-field--wide">
              Descrição
              <input name="description" />
            </label>
            <button className="button button--primary" disabled={working === "plan"}>
              Criar plano
            </button>
          </form>
        ) : null}

        <div className="platform-plan-grid">
          {plans.map((plan) => (
            <article key={plan.id}>
              <span>{plan.code}</span>
              <strong>{plan.name}</strong>
              <b>{money(plan.monthlyPrice)}/mês</b>
              <small>
                {plan.maxStudents ? plan.maxStudents + " alunos" : "Alunos ilimitados"}
                {" • "}
                {plan.maxUsers ? plan.maxUsers + " usuários" : "Usuários ilimitados"}
              </small>
              <em>{plan._count.subscriptions} assinatura(s)</em>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">TENANTS</span>
            <h2>Escolas da plataforma</h2>
          </div>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => setCreateSchoolOpen((value) => !value)}
          >
            + Escola
          </button>
        </div>

        {createSchoolOpen ? (
          <form className="platform-school-form" onSubmit={createSchool}>
            <label>
              Escola
              <input name="name" required />
            </label>
            <label>
              Slug
              <input name="slug" placeholder="colegio-exemplo" />
            </label>
            <label>
              CNPJ/documento
              <input name="document" />
            </label>
            <label>
              Plano inicial
              <select name="planId" defaultValue="">
                <option value="">Sem plano por enquanto</option>
                {plans
                  .filter((item) => item.active)
                  .map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Cobrança do SaaS
              <select name="provider" defaultValue="MANUAL">
                <option value="MANUAL">Manual</option>
                <option value="ASAAS">Asaas da plataforma</option>
              </select>
            </label>
            <label>
              Ciclo
              <select name="billingInterval" defaultValue="MONTHLY">
                <option value="MONTHLY">Mensal</option>
                <option value="ANNUAL">Anual</option>
              </select>
            </label>
            <label>
              Administrador
              <input name="adminName" required />
            </label>
            <label>
              E-mail do admin
              <input name="adminEmail" type="email" required />
            </label>
            <label>
              Senha inicial
              <input
                name="adminPassword"
                type="password"
                minLength={10}
                required
              />
            </label>
            <button className="button button--primary" disabled={working === "school"}>
              Criar tenant
            </button>
          </form>
        ) : null}

        <div className="platform-school-list">
          {schools.map((school) => (
            <article key={school.id}>
              <div>
                <span className="eyebrow">{school.slug || "SEM SLUG"}</span>
                <strong>{school.name}</strong>
                <small>
                  {school._count.students} alunos • {school._count.users} usuários •{" "}
                  {school._count.classes} turmas
                </small>
              </div>

              <div>
                <small>Plano</small>
                <strong>{school.subscription?.plan.name || "Sem plano"}</strong>
                <span>{school.subscription?.status || "—"}</span>
              </div>

              <label>
                Tenant
                <select
                  value={school.lifecycleStatus}
                  disabled={working === "school:" + school.id}
                  onChange={(event) =>
                    void updateSchool(school, {
                      lifecycleStatus: event.target.value,
                    })
                  }
                >
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Ativo</option>
                  <option value="SUSPENDED">Suspenso</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </label>

              <label>
                Alterar plano
                <select
                  value={school.subscription?.plan.id || ""}
                  disabled={working === "school:" + school.id}
                  onChange={(event) =>
                    void updateSchool(school, {
                      planId: event.target.value,
                      subscriptionStatus:
                        school.subscription?.status || "TRIAL",
                    })
                  }
                >
                  <option value="">Sem plano</option>
                  {plans
                    .filter((item) => item.active)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                </select>
              </label>

              {school.subscription ? (
                <>
                  <label>
                    Cobrança
                    <select
                      value={school.subscription.provider}
                      disabled={working === "school:" + school.id}
                      onChange={(event) =>
                        void updateSchool(school, {
                          provider: event.target.value,
                        })
                      }
                    >
                      <option value="MANUAL">Manual</option>
                      <option value="ASAAS">Asaas</option>
                    </select>
                  </label>

                  <label>
                    Ciclo
                    <select
                      value={school.subscription.billingInterval}
                      disabled={working === "school:" + school.id}
                      onChange={(event) =>
                        void updateSchool(school, {
                          billingInterval: event.target.value,
                        })
                      }
                    >
                      <option value="MONTHLY">Mensal</option>
                      <option value="ANNUAL">Anual</option>
                    </select>
                  </label>

                  <div className="platform-billing-actions">
                    <small>
                      Próxima:{" "}
                      {school.subscription.nextBillingAt
                        ? new Intl.DateTimeFormat("pt-BR").format(
                            new Date(school.subscription.nextBillingAt),
                          )
                        : "—"}
                    </small>
                    {school.subscription.invoices[0] ? (
                      <small>
                        Última fatura: {school.subscription.invoices[0].status} •{" "}
                        {money(school.subscription.invoices[0].amount)}
                      </small>
                    ) : null}
                    {school.subscription.invoices[0]?.invoiceUrl ? (
                      <a
                        className="inline-action"
                        href={school.subscription.invoices[0].invoiceUrl!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir fatura
                      </a>
                    ) : null}
                    {school.subscription.provider === "ASAAS" ? (
                      <button
                        className="button button--secondary button--small"
                        type="button"
                        disabled={working === "invoice:" + school.id}
                        onClick={() => void issueInvoice(school)}
                      >
                        Emitir cobrança
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
