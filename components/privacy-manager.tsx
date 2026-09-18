"use client";

import { FormEvent, useEffect, useState } from "react";

type PrivacySettings = {
  academicRetentionYears: number;
  financialRetentionYears: number;
  auditRetentionDays: number;
  allowPortalRequests: boolean;
};

type PrivacyRequest = {
  id: string;
  type: "ACCESS_EXPORT" | "CORRECTION" | "ANONYMIZATION" | "DELETION";
  status: "OPEN" | "IN_REVIEW" | "COMPLETED" | "REJECTED";
  subjectType: "STUDENT" | "GUARDIAN" | "USER";
  subjectId: string;
  reason: string | null;
  resolution: string | null;
  createdAt: string;
  processedAt: string | null;
};

const typeLabels: Record<string, string> = {
  ACCESS_EXPORT: "Acesso / exportação",
  CORRECTION: "Correção",
  ANONYMIZATION: "Anonimização",
  DELETION: "Exclusão / anonimização",
};

const statusLabels: Record<string, string> = {
  OPEN: "Aberta",
  IN_REVIEW: "Em análise",
  COMPLETED: "Concluída",
  REJECTED: "Rejeitada",
};

export function PrivacyManager() {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");

    try {
      const [settingsResponse, requestsResponse] = await Promise.all([
        fetch("/api/privacy/settings", { cache: "no-store" }),
        fetch("/api/privacy/requests", { cache: "no-store" }),
      ]);

      const [settingsData, requestsData] = await Promise.all([
        settingsResponse.json(),
        requestsResponse.json(),
      ]);

      if (!settingsResponse.ok) {
        setError(settingsData.error || "Não foi possível carregar a política.");
        return;
      }

      if (!requestsResponse.ok) {
        setError(requestsData.error || "Não foi possível carregar as solicitações.");
        return;
      }

      setSettings(settingsData.settings);
      setRequests(requestsData.requests || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking("settings");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/privacy/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicRetentionYears: Number(form.get("academicRetentionYears")),
          financialRetentionYears: Number(form.get("financialRetentionYears")),
          auditRetentionDays: Number(form.get("auditRetentionDays")),
          allowPortalRequests: form.get("allowPortalRequests") === "on",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar a política.");
        return;
      }

      setMessage("Política de privacidade atualizada.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function updateRequest(
    request: PrivacyRequest,
    status: "IN_REVIEW" | "REJECTED",
  ) {
    const resolution =
      status === "REJECTED"
        ? window.prompt("Motivo da rejeição:") || ""
        : "";

    if (status === "REJECTED" && !resolution.trim()) return;

    setWorking("request:" + request.id);
    setError("");

    try {
      const response = await fetch("/api/privacy/requests/" + request.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível atualizar a solicitação.");
        return;
      }

      setMessage("Solicitação atualizada.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function executeRequest(request: PrivacyRequest) {
    if (
      !window.confirm(
        "Executar a anonimização agora? Esta ação altera dados identificadores e não deve ser usada sem revisão.",
      )
    ) {
      return;
    }

    setWorking("request:" + request.id);
    setError("");

    try {
      const response = await fetch(
        "/api/privacy/requests/" + request.id + "/execute",
        { method: "POST" },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível executar a solicitação.");
        return;
      }

      setMessage("Anonimização concluída e auditada.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="privacy-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PRODUCTION HARDENING • LGPD</span>
          <h2>Privacidade & retenção</h2>
          <p>
            Solicitações do titular, retenção configurável, exportação e
            anonimização controlada.
          </p>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      {settings ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">POLÍTICA</span>
              <h2>Retenção institucional</h2>
            </div>
          </div>

          <form className="privacy-settings-form" onSubmit={saveSettings}>
            <label>
              Histórico acadêmico
              <input
                name="academicRetentionYears"
                type="number"
                min="1"
                max="50"
                defaultValue={settings.academicRetentionYears}
              />
              <small>anos</small>
            </label>
            <label>
              Registros financeiros
              <input
                name="financialRetentionYears"
                type="number"
                min="1"
                max="50"
                defaultValue={settings.financialRetentionYears}
              />
              <small>anos</small>
            </label>
            <label>
              Auditoria
              <input
                name="auditRetentionDays"
                type="number"
                min="30"
                max="3650"
                defaultValue={settings.auditRetentionDays}
              />
              <small>dias</small>
            </label>
            <label className="check-field">
              <input
                name="allowPortalRequests"
                type="checkbox"
                defaultChecked={settings.allowPortalRequests}
              />
              Permitir solicitações pelo portal
            </label>
            <button
              className="button button--primary"
              disabled={working === "settings"}
            >
              Salvar política
            </button>
          </form>

          <p className="privacy-note">
            Os prazos são parâmetros administrativos. O sistema não apaga
            automaticamente histórico acadêmico ou financeiro: solicitações
            sensíveis passam por revisão antes da anonimização.
          </p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">SOLICITAÇÕES</span>
            <h2>Direitos do titular</h2>
          </div>
        </div>

        <div className="privacy-request-list">
          {requests.map((request) => (
            <article key={request.id}>
              <div>
                <strong>{typeLabels[request.type]}</strong>
                <span>
                  {request.subjectType} • {request.subjectId}
                </span>
                <small>
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(request.createdAt))}
                </small>
                {request.reason ? <p>{request.reason}</p> : null}
                {request.resolution ? (
                  <p className="privacy-resolution">{request.resolution}</p>
                ) : null}
              </div>

              <span
                className={
                  request.status === "COMPLETED"
                    ? "status-chip status-chip--success"
                    : request.status === "REJECTED"
                      ? "status-chip report-status--failed"
                      : "status-chip status-chip--warning"
                }
              >
                {statusLabels[request.status]}
              </span>

              <div className="privacy-request-actions">
                {request.status === "OPEN" ? (
                  <button
                    className="button button--secondary button--small"
                    type="button"
                    disabled={working === "request:" + request.id}
                    onClick={() => void updateRequest(request, "IN_REVIEW")}
                  >
                    Iniciar análise
                  </button>
                ) : null}

                {["OPEN", "IN_REVIEW"].includes(request.status) &&
                ["ANONYMIZATION", "DELETION"].includes(request.type) ? (
                  <button
                    className="button button--primary button--small"
                    type="button"
                    disabled={working === "request:" + request.id}
                    onClick={() => void executeRequest(request)}
                  >
                    Executar anonimização
                  </button>
                ) : null}

                {["OPEN", "IN_REVIEW"].includes(request.status) ? (
                  <button
                    className="inline-action inline-action--danger"
                    type="button"
                    disabled={working === "request:" + request.id}
                    onClick={() => void updateRequest(request, "REJECTED")}
                  >
                    Rejeitar
                  </button>
                ) : null}
              </div>
            </article>
          ))}

          {!requests.length ? (
            <div className="empty-records">
              <span>◉</span>
              <h3>Nenhuma solicitação LGPD</h3>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
