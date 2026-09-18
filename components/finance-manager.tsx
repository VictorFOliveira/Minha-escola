"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Settings = {
  provider: "MANUAL" | "ASAAS" | "EXTERNAL";
  gatewayEnabled: boolean;
  externalPaymentUrl: string | null;
  sendBillingToGuardian: boolean;
  sendReportToGuardian: boolean;
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
  schoolYear: number;
  installmentAmount: string | number;
  installments: number;
  dueDay: number;
  active: boolean;
  _count?: { contracts: number };
};

type EnrollmentOption = {
  id: string;
  student: { id: string; name: string; registration: string };
  class: { id: string; name: string; schoolYear: number };
  financialGuardian: { id: string; name: string } | null;
  billingContract: { id: string; status: string } | null;
};

type Contract = {
  id: string;
  status: string;
  installmentAmount: string | number;
  installments: number;
  dueDay: number;
  firstDueDate: string;
  enrollment: {
    id: string;
    student: { id: string; name: string; registration: string };
    class: { id: string; name: string; schoolYear: number };
  };
  guardian: { id: string; name: string } | null;
  billingPlan: Plan | null;
  benefits: Array<{
    id: string;
    name: string;
    type: string;
    valueType: "PERCENTAGE" | "FIXED";
    value: string | number;
  }>;
  _count: { charges: number };
};

type Charge = {
  id: string;
  installmentNumber: number | null;
  description: string;
  amount: string | number;
  paidAmount: string | number;
  dueDate: string;
  status: string;
  provider: "MANUAL" | "ASAAS" | "EXTERNAL";
  paymentMethod: string | null;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixCopyPaste: string | null;
  student: { id: string; name: string; registration: string };
  guardian: { id: string; name: string } | null;
  enrollment: { class: { name: string; schoolYear: number } } | null;
};

type Summary = {
  totalReceived: number;
  totalReceivable: number;
  open: number;
  overdue: number;
  overdueGuardians: number;
  charges: number;
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    PARTIAL: "Parcial",
    PAID: "Pago",
    OVERDUE: "Em atraso",
    CANCELLED: "Cancelada",
    REFUNDED: "Estornada",
  };

  return labels[status] || status;
}

export function FinanceManager({ canConfigure }: { canConfigure: boolean }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [asaasConfigured, setAsaasConfigured] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [benefitContractId, setBenefitContractId] = useState("");
  const [paymentCharge, setPaymentCharge] = useState<Charge | null>(null);
  const [issueCharge, setIssueCharge] = useState<Charge | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [benefitOpen, setBenefitOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const responses = await Promise.all([
        fetch("/api/finance/settings", { cache: "no-store" }),
        fetch("/api/finance/plans", { cache: "no-store" }),
        fetch("/api/finance/enrollments", { cache: "no-store" }),
        fetch("/api/finance/contracts", { cache: "no-store" }),
        fetch("/api/finance/charges", { cache: "no-store" }),
        fetch("/api/finance/summary", { cache: "no-store" }),
      ]);

      const data = await Promise.all(responses.map((response) => response.json()));

      for (let index = 0; index < responses.length; index += 1) {
        if (!responses[index].ok) {
          setError(data[index].error || "Não foi possível carregar o financeiro.");
          return;
        }
      }

      setSettings(data[0].settings);
      setAsaasConfigured(Boolean(data[0].asaasConfigured));
      setPlans(data[1].plans || []);
      setEnrollments(data[2].enrollments || []);
      setContracts(data[3].contracts || []);
      setCharges(data[4].charges || []);
      setSummary(data[5].summary || null);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const eligibleEnrollments = useMemo(
    () => enrollments.filter((item) => !item.billingContract),
    [enrollments],
  );

  const selectedEnrollment = enrollments.find(
    (item) => item.id === selectedEnrollmentId,
  );
  const compatiblePlans = plans.filter(
    (plan) =>
      plan.active &&
      (!selectedEnrollment ||
        plan.schoolYear === selectedEnrollment.class.schoolYear),
  );

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;

    const form = new FormData(event.currentTarget);
    setWorking("settings");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/finance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: String(form.get("provider") || "MANUAL"),
          gatewayEnabled: form.get("gatewayEnabled") === "on",
          externalPaymentUrl: String(form.get("externalPaymentUrl") || ""),
          sendBillingToGuardian: form.get("sendBillingToGuardian") === "on",
          sendReportToGuardian: form.get("sendReportToGuardian") === "on",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar a configuração.");
        return;
      }

      setMessage("Configuração financeira atualizada.");
      setSettingsOpen(false);
      await loadAll();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking("plan");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/finance/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          description: String(form.get("description") || ""),
          schoolYear: String(form.get("schoolYear") || ""),
          installmentAmount: String(form.get("installmentAmount") || ""),
          installments: String(form.get("installments") || ""),
          dueDay: String(form.get("dueDay") || ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível criar o plano.");
        return;
      }

      event.currentTarget.reset();
      setPlanOpen(false);
      setMessage("Plano financeiro criado.");
      await loadAll();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking("contract");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/finance/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: String(form.get("enrollmentId") || ""),
          billingPlanId: String(form.get("billingPlanId") || ""),
          firstDueDate: String(form.get("firstDueDate") || ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível criar o contrato financeiro.");
        return;
      }

      setContractOpen(false);
      setSelectedEnrollmentId("");
      setSelectedPlanId("");
      setMessage("Contrato financeiro criado.");
      await loadAll();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function createBenefit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!benefitContractId) return;

    const form = new FormData(event.currentTarget);
    setWorking("benefit");
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/finance/contracts/" + benefitContractId + "/benefits",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(form.get("name") || ""),
            type: String(form.get("type") || "DISCOUNT"),
            valueType: String(form.get("valueType") || "PERCENTAGE"),
            value: String(form.get("value") || ""),
            startsAt: String(form.get("startsAt") || ""),
            endsAt: String(form.get("endsAt") || ""),
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível adicionar o benefício.");
        return;
      }

      event.currentTarget.reset();
      setBenefitOpen(false);
      setBenefitContractId("");
      setMessage("Bolsa/desconto adicionado ao contrato.");
      await loadAll();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function generateCharges(contractId: string) {
    setWorking("generate:" + contractId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/finance/contracts/" + contractId + "/generate",
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível gerar as mensalidades.");
        return;
      }

      setMessage(
        data.created
          ? data.created + " cobrança(s) gerada(s)."
          : "Todas as parcelas deste contrato já estavam geradas.",
      );
      await loadAll();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function saveManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentCharge) return;

    const form = new FormData(event.currentTarget);
    setWorking("payment");
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/finance/charges/" + paymentCharge.id + "/payments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: String(form.get("amount") || ""),
            method: String(form.get("method") || "OTHER"),
            paidAt: String(form.get("paidAt") || ""),
            note: String(form.get("note") || ""),
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível registrar o pagamento.");
        return;
      }

      setPaymentCharge(null);
      setMessage("Pagamento registrado e cobrança conciliada.");
      await loadAll();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function issueGatewayCharge(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!issueCharge) return;

    const form = new FormData(event.currentTarget);
    setWorking("issue");
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/finance/charges/" + issueCharge.id + "/issue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billingType: String(form.get("billingType") || "UNDEFINED"),
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível emitir a cobrança.");
        return;
      }

      setIssueCharge(null);
      setMessage(
        data.provider === "EXTERNAL"
          ? "A escola usa sistema externo. Nenhuma cobrança Asaas foi criada."
          : "Cobrança emitida no Asaas.",
      );
      await loadAll();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="finance-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FASE 8 • FINANCEIRO</span>
          <h2>Financeiro escolar</h2>
          <p>
            Planos, contratos por matrícula, bolsas, mensalidades, pagamentos e
            inadimplência.
          </p>
        </div>
        <div className="finance-heading-actions">
          {canConfigure ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setSettingsOpen((value) => !value)}
            >
              Configuração
            </button>
          ) : null}
          <button
            className="button button--primary"
            type="button"
            onClick={() => setContractOpen((value) => !value)}
          >
            + Contrato
          </button>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      {loading ? (
        <div className="loading-state">Carregando financeiro...</div>
      ) : (
        <>
          <section className="finance-kpis">
            <article>
              <span>Recebido</span>
              <strong>{money(summary?.totalReceived)}</strong>
              <small>{summary?.charges || 0} cobranças no histórico</small>
            </article>
            <article>
              <span>A receber</span>
              <strong>{money(summary?.totalReceivable)}</strong>
              <small>{money(summary?.open)} ainda dentro do prazo</small>
            </article>
            <article>
              <span>Em atraso</span>
              <strong>{money(summary?.overdue)}</strong>
              <small>
                {summary?.overdueGuardians || 0} responsável(is) com pendência
              </small>
            </article>
            <article>
              <span>Gateway</span>
              <strong>
                {settings?.gatewayEnabled ? settings.provider : "Desativado"}
              </strong>
              <small>
                {settings?.provider === "ASAAS" && !asaasConfigured
                  ? "Chave Asaas ainda não configurada no servidor"
                  : "Integração opcional por escola"}
              </small>
            </article>
          </section>

          {canConfigure && settingsOpen && settings ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">INTEGRAÇÃO</span>
                  <h2>Como a escola recebe pagamentos?</h2>
                </div>
              </div>

              <form className="finance-settings-form" onSubmit={saveSettings}>
                <label>
                  Modo de pagamento
                  <select name="provider" defaultValue={settings.provider}>
                    <option value="MANUAL">Interno / baixa manual</option>
                    <option value="ASAAS">Asaas</option>
                    <option value="EXTERNAL">Sistema próprio da escola</option>
                  </select>
                </label>

                <label>
                  URL do sistema externo
                  <input
                    name="externalPaymentUrl"
                    type="url"
                    defaultValue={settings.externalPaymentUrl || ""}
                    placeholder="https://pagamentos.escola.com.br"
                  />
                </label>

                <label className="check-field">
                  <input
                    name="gatewayEnabled"
                    type="checkbox"
                    defaultChecked={settings.gatewayEnabled}
                  />
                  Gateway ativado
                </label>

                <label className="check-field">
                  <input
                    name="sendBillingToGuardian"
                    type="checkbox"
                    defaultChecked={settings.sendBillingToGuardian}
                  />
                  Mostrar cobranças ao responsável
                </label>

                <label className="check-field">
                  <input
                    name="sendReportToGuardian"
                    type="checkbox"
                    defaultChecked={settings.sendReportToGuardian}
                  />
                  Mostrar boletim ao responsável
                </label>

                <button
                  className="button button--primary"
                  disabled={working === "settings"}
                >
                  {working === "settings" ? "Salvando..." : "Salvar configuração"}
                </button>
              </form>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PLANOS</span>
                <h2>Planos financeiros</h2>
              </div>
              <button
                className="button button--primary button--small"
                type="button"
                onClick={() => setPlanOpen((value) => !value)}
              >
                + Plano
              </button>
            </div>

            {planOpen ? (
              <form className="finance-plan-form" onSubmit={createPlan}>
                <label>
                  Nome
                  <input name="name" required placeholder="Ex.: Mensalidade 2027" />
                </label>
                <label>
                  Ano letivo
                  <input
                    name="schoolYear"
                    type="number"
                    min="2000"
                    max="2100"
                    defaultValue={new Date().getFullYear()}
                    required
                  />
                </label>
                <label>
                  Valor da parcela
                  <input
                    name="installmentAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Parcelas
                  <input
                    name="installments"
                    type="number"
                    min="1"
                    max="24"
                    defaultValue="12"
                    required
                  />
                </label>
                <label>
                  Dia de vencimento
                  <input
                    name="dueDay"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue="10"
                    required
                  />
                </label>
                <label className="finance-field--wide">
                  Descrição
                  <input
                    name="description"
                    placeholder="Mensalidade regular, integral, infantil..."
                  />
                </label>
                <button className="button button--primary" disabled={working === "plan"}>
                  Criar plano
                </button>
              </form>
            ) : null}

            <div className="finance-plan-grid">
              {plans.map((plan) => (
                <article key={plan.id}>
                  <span>{plan.schoolYear}</span>
                  <strong>{plan.name}</strong>
                  <b>{money(plan.installmentAmount)}</b>
                  <small>
                    {plan.installments}x • vence dia {plan.dueDay} •{" "}
                    {plan._count?.contracts || 0} contrato(s)
                  </small>
                </article>
              ))}
            </div>
          </section>

          {contractOpen ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">NOVO CONTRATO</span>
                  <h2>Vincular plano à matrícula</h2>
                </div>
              </div>

              <form className="finance-contract-form" onSubmit={createContract}>
                <label>
                  Matrícula
                  <select
                    name="enrollmentId"
                    required
                    value={selectedEnrollmentId}
                    onChange={(event) => {
                      setSelectedEnrollmentId(event.target.value);
                      setSelectedPlanId("");
                    }}
                  >
                    <option value="">Selecione...</option>
                    {eligibleEnrollments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.student.name} • {item.class.name} •{" "}
                        {item.class.schoolYear}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Plano
                  <select
                    name="billingPlanId"
                    required
                    value={selectedPlanId}
                    onChange={(event) => setSelectedPlanId(event.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {compatiblePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} • {money(plan.installmentAmount)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Primeira parcela
                  <input name="firstDueDate" type="date" required />
                </label>

                <div className="finance-guardian-preview">
                  <small>Responsável financeiro</small>
                  <strong>
                    {selectedEnrollment?.financialGuardian?.name ||
                      "Defina o responsável financeiro antes"}
                  </strong>
                </div>

                <button
                  className="button button--primary"
                  disabled={
                    working === "contract" ||
                    !selectedEnrollment?.financialGuardian
                  }
                >
                  Criar contrato
                </button>
              </form>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">CONTRATOS</span>
                <h2>Matrículas contratadas</h2>
              </div>
            </div>

            <div className="finance-contract-list">
              {contracts.map((contract) => (
                <article key={contract.id}>
                  <div>
                    <strong>{contract.enrollment.student.name}</strong>
                    <span>
                      {contract.enrollment.class.name} •{" "}
                      {contract.enrollment.class.schoolYear}
                    </span>
                    <small>
                      Responsável: {contract.guardian?.name || "—"}
                    </small>
                  </div>

                  <div>
                    <small>Plano</small>
                    <strong>{contract.billingPlan?.name || "Personalizado"}</strong>
                    <span>
                      {contract.installments}x de{" "}
                      {money(contract.installmentAmount)}
                    </span>
                  </div>

                  <div>
                    <small>Benefícios</small>
                    <strong>{contract.benefits.length}</strong>
                    <span>
                      {contract.benefits.length
                        ? contract.benefits.map((item) => item.name).join(", ")
                        : "Sem bolsa/desconto"}
                    </span>
                  </div>

                  <div>
                    <small>Cobranças</small>
                    <strong>{contract._count.charges}</strong>
                    <span>{contract.status}</span>
                  </div>

                  <div className="finance-contract-actions">
                    <button
                      className="inline-action"
                      type="button"
                      onClick={() => {
                        setBenefitContractId(contract.id);
                        setBenefitOpen(true);
                      }}
                    >
                      + Bolsa/desconto
                    </button>
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      disabled={working === "generate:" + contract.id}
                      onClick={() => void generateCharges(contract.id)}
                    >
                      {working === "generate:" + contract.id
                        ? "Gerando..."
                        : "Gerar parcelas"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {benefitOpen ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">BOLSA / DESCONTO</span>
                  <h2>Adicionar benefício financeiro</h2>
                </div>
              </div>

              <form className="finance-benefit-form" onSubmit={createBenefit}>
                <label>
                  Nome
                  <input name="name" required placeholder="Ex.: Bolsa mérito" />
                </label>
                <label>
                  Tipo
                  <select name="type" defaultValue="DISCOUNT">
                    <option value="DISCOUNT">Desconto</option>
                    <option value="SCHOLARSHIP">Bolsa</option>
                  </select>
                </label>
                <label>
                  Formato
                  <select name="valueType" defaultValue="PERCENTAGE">
                    <option value="PERCENTAGE">Percentual</option>
                    <option value="FIXED">Valor fixo</option>
                  </select>
                </label>
                <label>
                  Valor
                  <input
                    name="value"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Início
                  <input name="startsAt" type="date" />
                </label>
                <label>
                  Fim
                  <input name="endsAt" type="date" />
                </label>
                <button
                  className="button button--primary"
                  disabled={working === "benefit"}
                >
                  Adicionar benefício
                </button>
              </form>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">COBRANÇAS</span>
                <h2>Mensalidades e recebimentos</h2>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table finance-charge-table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Parcela</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Pago</th>
                    <th>Status</th>
                    <th>Gateway</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((charge) => (
                    <tr key={charge.id}>
                      <td>
                        <span className="enrollment-student">
                          <strong>{charge.student.name}</strong>
                          <small>{charge.guardian?.name || "Sem responsável"}</small>
                        </span>
                      </td>
                      <td>{charge.installmentNumber || "—"}</td>
                      <td>
                        {new Intl.DateTimeFormat("pt-BR").format(
                          new Date(charge.dueDate),
                        )}
                      </td>
                      <td>{money(charge.amount)}</td>
                      <td>{money(charge.paidAmount)}</td>
                      <td>
                        <span
                          className={
                            charge.status === "PAID"
                              ? "status-chip status-chip--success"
                              : charge.status === "OVERDUE"
                                ? "status-chip finance-status--overdue"
                                : charge.status === "PARTIAL"
                                  ? "status-chip status-chip--warning"
                                  : "status-chip"
                          }
                        >
                          {statusLabel(charge.status)}
                        </span>
                      </td>
                      <td>{charge.provider}</td>
                      <td>
                        <div className="mini-actions">
                          {!["PAID", "CANCELLED", "REFUNDED"].includes(
                            charge.status,
                          ) ? (
                            <button
                              className="inline-action"
                              type="button"
                              onClick={() => setPaymentCharge(charge)}
                            >
                              Dar baixa
                            </button>
                          ) : null}
                          {!["PAID", "CANCELLED", "REFUNDED"].includes(
                            charge.status,
                          ) &&
                          settings?.gatewayEnabled &&
                          settings.provider !== "MANUAL" ? (
                            <button
                              className="inline-action"
                              type="button"
                              onClick={() => setIssueCharge(charge)}
                            >
                              Emitir
                            </button>
                          ) : null}
                          {charge.invoiceUrl ? (
                            <a
                              className="inline-action"
                              href={charge.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Fatura
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {paymentCharge ? (
        <div className="finance-modal-backdrop" onClick={() => setPaymentCharge(null)}>
          <section
            className="finance-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">BAIXA MANUAL</span>
                <h2>{paymentCharge.student.name}</h2>
              </div>
              <button className="more-button" type="button" onClick={() => setPaymentCharge(null)}>
                ✕
              </button>
            </div>
            <form className="finance-payment-form" onSubmit={saveManualPayment}>
              <label>
                Valor
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={
                    Number(paymentCharge.amount) -
                    Number(paymentCharge.paidAmount)
                  }
                  defaultValue={
                    Number(paymentCharge.amount) -
                    Number(paymentCharge.paidAmount)
                  }
                  required
                />
              </label>
              <label>
                Forma
                <select name="method" defaultValue="PIX">
                  <option value="PIX">PIX</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="CREDIT_CARD">Cartão</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="BANK_TRANSFER">Transferência</option>
                  <option value="OTHER">Outra</option>
                </select>
              </label>
              <label>
                Data
                <input
                  name="paidAt"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </label>
              <label className="finance-field--wide">
                Observação
                <input name="note" placeholder="Comprovante, caixa, referência..." />
              </label>
              <button className="button button--primary" disabled={working === "payment"}>
                {working === "payment" ? "Salvando..." : "Confirmar pagamento"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {issueCharge ? (
        <div className="finance-modal-backdrop" onClick={() => setIssueCharge(null)}>
          <section
            className="finance-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">EMISSÃO</span>
                <h2>{issueCharge.student.name}</h2>
              </div>
              <button className="more-button" type="button" onClick={() => setIssueCharge(null)}>
                ✕
              </button>
            </div>

            {settings?.provider === "EXTERNAL" ? (
              <div className="external-payment-card">
                <strong>Sistema próprio da escola</strong>
                <p>
                  O Minha Escola não criará uma cobrança em outro gateway. O
                  responsável será direcionado ao sistema configurado pela escola.
                </p>
                {settings.externalPaymentUrl ? (
                  <a
                    className="button button--primary"
                    href={settings.externalPaymentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir sistema externo
                  </a>
                ) : null}
              </div>
            ) : (
              <form className="finance-payment-form" onSubmit={issueGatewayCharge}>
                <label>
                  Forma oferecida
                  <select name="billingType" defaultValue="UNDEFINED">
                    <option value="UNDEFINED">PIX ou boleto na fatura</option>
                    <option value="PIX">Somente PIX</option>
                    <option value="BOLETO">Somente boleto</option>
                  </select>
                </label>
                <button className="button button--primary" disabled={working === "issue"}>
                  {working === "issue" ? "Emitindo..." : "Emitir no Asaas"}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
