"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Role =
  | "ADMIN"
  | "COORDINATOR"
  | "SECRETARY"
  | "TEACHER"
  | "FINANCE"
  | "STUDENT"
  | "GUARDIAN";

type EnrollmentOption = {
  id: string;
  status: string;
  student: { id: string; name: string; registration: string };
  class: {
    id: string;
    name: string;
    gradeLevel: string;
    schoolYear: number;
  };
};

type ChargeOption = {
  id: string;
  description: string;
  amount: string | number;
  paidAmount: string | number;
  paidAt: string | null;
  student: { id: string; name: string; registration: string };
  guardian: { id: string; name: string } | null;
};

type DocumentItem = {
  id: string;
  type: string;
  status: "ISSUED" | "CANCELLED";
  title: string;
  verificationCode: string;
  issuedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  student: { id: string; name: string; registration: string } | null;
  guardian: { id: string; name: string } | null;
  issuedBy: { id: string; name: string; role: string };
};

const typeLabels: Record<string, string> = {
  ENROLLMENT_DECLARATION: "Declaração de matrícula",
  ATTENDANCE_DECLARATION: "Declaração de frequência",
  REPORT_CARD: "Boletim escolar",
  SCHOOL_RECORD: "Histórico escolar",
  PAYMENT_RECEIPT: "Recibo de pagamento",
  ENROLLMENT_CONTRACT: "Resumo/contrato de matrícula",
  CUSTOM: "Documento personalizado",
};

function money(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export function DocumentManager({ role }: { role: Role }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [charges, setCharges] = useState<ChargeOption[]>([]);
  const [type, setType] = useState(
    role === "FINANCE" ? "PAYMENT_RECEIPT" : "ENROLLMENT_DECLARATION",
  );
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");

    try {
      const [docsResponse, optionsResponse] = await Promise.all([
        fetch("/api/documents", { cache: "no-store" }),
        fetch("/api/documents/options", { cache: "no-store" }),
      ]);

      const [docsData, optionsData] = await Promise.all([
        docsResponse.json(),
        optionsResponse.json(),
      ]);

      if (!docsResponse.ok) {
        setError(docsData.error || "Não foi possível carregar os documentos.");
        return;
      }

      if (!optionsResponse.ok) {
        setError(optionsData.error || "Não foi possível carregar as opções.");
        return;
      }

      setDocuments(docsData.documents || []);
      setEnrollments(optionsData.enrollments || []);
      setCharges(optionsData.charges || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const allowedTypes = useMemo(
    () =>
      role === "FINANCE"
        ? ["PAYMENT_RECEIPT"]
        : [
            "ENROLLMENT_DECLARATION",
            "ATTENDANCE_DECLARATION",
            "REPORT_CARD",
            "SCHOOL_RECORD",
            "ENROLLMENT_CONTRACT",
            "CUSTOM",
          ],
    [role],
  );

  const needsCharge = type === "PAYMENT_RECEIPT";
  const isCustom = type === "CUSTOM";

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    setWorking("issue");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          enrollmentId: String(form.get("enrollmentId") || ""),
          chargeId: String(form.get("chargeId") || ""),
          customTitle: String(form.get("customTitle") || ""),
          customContent: String(form.get("customContent") || ""),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível emitir o documento.");
        return;
      }

      setMessage(
        "Documento emitido. Código de verificação: " +
          data.document.verificationCode,
      );
      await load();

      window.open(
        "/api/documents/" + data.document.id + "/html",
        "_blank",
        "noopener,noreferrer",
      );
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function cancel(document: DocumentItem) {
    const reason =
      window.prompt(
        "Motivo do cancelamento:",
        "Documento substituído/corrigido.",
      ) || "";

    if (!reason.trim()) return;

    setWorking("cancel:" + document.id);
    setError("");

    try {
      const response = await fetch(
        "/api/documents/" + document.id + "/cancel",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível cancelar o documento.");
        return;
      }

      setMessage("Documento cancelado. O código de verificação preserva o histórico.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="document-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FASE 10 • SECRETARIA</span>
          <h2>Documentos escolares</h2>
          <p>
            Emita documentos com snapshot imutável, impressão e código público
            de verificação.
          </p>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">NOVA EMISSÃO</span>
            <h2>Gerar documento</h2>
          </div>
        </div>

        <form className="document-form" onSubmit={issue}>
          <label>
            Tipo
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {allowedTypes.map((value) => (
                <option key={value} value={value}>
                  {typeLabels[value]}
                </option>
              ))}
            </select>
          </label>

          {needsCharge ? (
            <label className="document-field--wide">
              Pagamento
              <select name="chargeId" required>
                <option value="">Selecione...</option>
                {charges.map((charge) => (
                  <option key={charge.id} value={charge.id}>
                    {charge.student.name} • {charge.description} • recebido{" "}
                    {money(charge.paidAmount)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="document-field--wide">
              Matrícula
              <select name="enrollmentId" required>
                <option value="">Selecione...</option>
                {enrollments.map((enrollment) => (
                  <option key={enrollment.id} value={enrollment.id}>
                    {enrollment.student.name} • {enrollment.class.name} •{" "}
                    {enrollment.class.schoolYear} •{" "}
                    {enrollment.student.registration}
                  </option>
                ))}
              </select>
            </label>
          )}

          {isCustom ? (
            <>
              <label className="document-field--wide">
                Título
                <input
                  name="customTitle"
                  required
                  placeholder="Ex.: Declaração para fins específicos"
                />
              </label>
              <label className="document-field--wide">
                Conteúdo
                <textarea
                  name="customContent"
                  rows={7}
                  required
                  placeholder="Texto oficial que será congelado no momento da emissão."
                />
              </label>
            </>
          ) : null}

          <div className="document-form-actions">
            <button
              className="button button--primary"
              disabled={working === "issue"}
            >
              {working === "issue" ? "Emitindo..." : "Emitir e abrir impressão"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">REGISTRO DE EMISSÕES</span>
            <h2>Documentos emitidos</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table document-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Aluno</th>
                <th>Emissão</th>
                <th>Código</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <span className="enrollment-student">
                      <strong>{document.title}</strong>
                      <small>{typeLabels[document.type] || document.type}</small>
                    </span>
                  </td>
                  <td>
                    {document.student
                      ? document.student.name +
                        " • " +
                        document.student.registration
                      : document.guardian?.name || "—"}
                  </td>
                  <td>
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(document.issuedAt),
                    )}
                    <small className="document-issued-by">
                      {document.issuedBy.name}
                    </small>
                  </td>
                  <td>
                    <code className="document-code">
                      {document.verificationCode}
                    </code>
                  </td>
                  <td>
                    <span
                      className={
                        document.status === "ISSUED"
                          ? "status-chip status-chip--success"
                          : "status-chip report-status--failed"
                      }
                    >
                      {document.status === "ISSUED" ? "Válido" : "Cancelado"}
                    </span>
                  </td>
                  <td>
                    <div className="mini-actions">
                      <a
                        className="inline-action"
                        href={"/api/documents/" + document.id + "/html"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir
                      </a>
                      <a
                        className="inline-action"
                        href={"/api/documents/" + document.id + "/pdf"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF
                      </a>
                      <a
                        className="inline-action"
                        href={"/verificar/" + document.verificationCode}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Verificar
                      </a>
                      {document.status === "ISSUED" && role !== "FINANCE" ? (
                        <button
                          className="inline-action inline-action--danger"
                          type="button"
                          disabled={working === "cancel:" + document.id}
                          onClick={() => void cancel(document)}
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!documents.length ? (
          <div className="empty-records">
            <span>▤</span>
            <h3>Nenhum documento emitido</h3>
            <p>As emissões aparecerão aqui com código de verificação.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
