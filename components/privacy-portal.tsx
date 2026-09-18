"use client";

import { FormEvent, useEffect, useState } from "react";

type PrivacyRequest = {
  id: string;
  type: string;
  status: string;
  reason: string | null;
  resolution: string | null;
  createdAt: string;
};

const labels: Record<string, string> = {
  ACCESS_EXPORT: "Acesso aos meus dados",
  CORRECTION: "Correção de dados",
  ANONYMIZATION: "Anonimização",
  DELETION: "Exclusão / anonimização",
};

export function PrivacyPortal() {
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/privacy/requests", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível carregar as solicitações.");
        return;
      }

      setRequests(data.requests || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/privacy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: String(form.get("type") || ""),
          reason: String(form.get("reason") || ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível abrir a solicitação.");
        return;
      }

      event.currentTarget.reset();
      setMessage("Solicitação registrada.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking(false);
    }
  }

  async function acceptPrivacyPolicy() {
    setWorking(true);
    setError("");

    try {
      const response = await fetch("/api/privacy/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "PRIVACY_POLICY",
          version: "2026-09",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível registrar a ciência.");
        return;
      }

      setMessage("Ciência da política de privacidade registrada.");
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="portal-panel privacy-portal">
      <div className="portal-panel-heading">
        <div>
          <span className="eyebrow">PRIVACIDADE</span>
          <h2>Meus dados</h2>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      <div className="privacy-portal-actions">
        <a
          className="button button--secondary button--small"
          href="/api/privacy/export"
          target="_blank"
          rel="noreferrer"
        >
          Baixar meus dados
        </a>
        <button
          className="button button--secondary button--small"
          type="button"
          disabled={working}
          onClick={() => void acceptPrivacyPolicy()}
        >
          Registrar ciência da política
        </button>
      </div>

      <form className="privacy-portal-form" onSubmit={submit}>
        <label>
          Solicitação
          <select name="type" required defaultValue="CORRECTION">
            <option value="ACCESS_EXPORT">Acesso aos meus dados</option>
            <option value="CORRECTION">Correção de dados</option>
            <option value="ANONYMIZATION">Anonimização</option>
            <option value="DELETION">Exclusão / anonimização</option>
          </select>
        </label>
        <label className="privacy-portal-field--wide">
          Detalhes
          <textarea
            name="reason"
            rows={3}
            placeholder="Explique o que você precisa."
          />
        </label>
        <button className="button button--primary button--small" disabled={working}>
          Enviar solicitação
        </button>
      </form>

      {requests.length ? (
        <div className="privacy-portal-history">
          {requests.slice(0, 6).map((request) => (
            <article key={request.id}>
              <strong>{labels[request.type] || request.type}</strong>
              <span>{request.status}</span>
              <small>
                {new Intl.DateTimeFormat("pt-BR").format(
                  new Date(request.createdAt),
                )}
              </small>
              {request.resolution ? <p>{request.resolution}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
