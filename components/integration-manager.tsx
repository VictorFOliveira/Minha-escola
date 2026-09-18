"use client";

import { FormEvent, useEffect, useState } from "react";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  active: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  _count: { deliveries: number };
};

const scopes = [
  "students:read",
  "enrollments:read",
  "finance:read",
  "attendance:read",
];

const events = [
  "student.created",
  "enrollment.created",
  "payment.received",
  "document.issued",
  "communication.published",
  "attendance.recorded",
  "grade.updated",
];

export function IntegrationManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [revealedSecret, setRevealedSecret] = useState<{
    title: string;
    value: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");

  async function load() {
    setError("");
    try {
      const [keyResponse, webhookResponse, featureResponse] =
        await Promise.all([
          fetch("/api/integrations/api-keys", { cache: "no-store" }),
          fetch("/api/integrations/webhooks", { cache: "no-store" }),
          fetch("/api/features", { cache: "no-store" }),
        ]);

      const [keyData, webhookData, featureData] =
        await Promise.all([
          keyResponse.json(),
          webhookResponse.json(),
          featureResponse.json(),
        ]);

      if (keyResponse.ok) setKeys(keyData.keys || []);
      if (webhookResponse.ok) setWebhooks(webhookData.webhooks || []);
      if (featureResponse.ok) setFeatures(featureData.features || {});
    } catch {
      setError("Não foi possível carregar as integrações.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedScopes = scopes.filter(
      (scope) => form.get("scope:" + scope) === "on",
    );

    setWorking("key");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/integrations/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          scopes: selectedScopes,
          expiresAt: String(form.get("expiresAt") || ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível criar a chave.");
        return;
      }

      setRevealedSecret({
        title: "API key — copie agora",
        value: data.secret,
      });
      event.currentTarget.reset();
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedEvents = events.filter(
      (name) => form.get("event:" + name) === "on",
    );

    setWorking("webhook");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          url: String(form.get("url") || ""),
          events: selectedEvents,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível criar o webhook.");
        return;
      }

      setRevealedSecret({
        title: "Signing secret — copie agora",
        value: data.signingSecret,
      });
      event.currentTarget.reset();
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function remove(kind: "api-keys" | "webhooks", id: string) {
    setWorking(kind + ":" + id);
    setError("");

    try {
      const response = await fetch(
        "/api/integrations/" + kind + "/" + id,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível revogar.");
        return;
      }

      setMessage("Integração revogada.");
      await load();
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="integration-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">INTEGRAÇÕES</span>
          <h2>API & webhooks</h2>
          <p>
            Integre ERP, catraca e sistemas externos sem acesso direto ao
            banco.
          </p>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      {revealedSecret ? (
        <div className="integration-secret" role="status">
          <strong>{revealedSecret.title}</strong>
          <code>{revealedSecret.value}</code>
          <p>Este segredo não será exibido novamente.</p>
          <button
            className="button button--secondary button--small"
            type="button"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(revealedSecret.value)
                .catch(() => null)
            }
          >
            Copiar
          </button>
          <button
            className="inline-action"
            type="button"
            onClick={() => setRevealedSecret(null)}
          >
            Fechar
          </button>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">API V1</span>
            <h2>Credenciais</h2>
          </div>
          <span className="status-chip">
            {features.api ? "Disponível no plano" : "Bloqueada pelo plano"}
          </span>
        </div>

        {features.api ? (
          <form className="integration-form" onSubmit={createKey}>
            <label>
              Nome
              <input name="name" required placeholder="ERP da escola" />
            </label>
            <label>
              Expira em
              <input name="expiresAt" type="date" />
            </label>
            <div className="integration-checks">
              {scopes.map((scope) => (
                <label className="check-field" key={scope}>
                  <input name={"scope:" + scope} type="checkbox" />
                  {scope}
                </label>
              ))}
            </div>
            <button className="button button--primary" disabled={working === "key"}>
              Criar API key
            </button>
          </form>
        ) : null}

        <div className="integration-list">
          {keys.map((key) => (
            <article key={key.id}>
              <div>
                <strong>{key.name}</strong>
                <code>{key.keyPrefix}••••••••</code>
                <small>{key.scopes.join(" • ")}</small>
              </div>
              <span>{key.active ? "Ativa" : "Revogada"}</span>
              {key.active ? (
                <button
                  className="inline-action inline-action--danger"
                  type="button"
                  disabled={working === "api-keys:" + key.id}
                  onClick={() => void remove("api-keys", key.id)}
                >
                  Revogar
                </button>
              ) : null}
            </article>
          ))}
        </div>

        <p className="communication-note">
          Endpoints: /api/v1/students, /api/v1/enrollments,
          /api/v1/charges e /api/v1/attendance. Use Authorization: Bearer
          &lt;API_KEY&gt;.
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">WEBHOOKS</span>
            <h2>Eventos de saída</h2>
          </div>
          <span className="status-chip">
            {features.webhooks ? "Disponível no plano" : "Bloqueado pelo plano"}
          </span>
        </div>

        {features.webhooks ? (
          <form className="integration-form" onSubmit={createWebhook}>
            <label>
              Nome
              <input name="name" required placeholder="ERP / automação" />
            </label>
            <label className="integration-field--wide">
              URL HTTPS
              <input name="url" type="url" required placeholder="https://..." />
            </label>
            <div className="integration-checks integration-field--wide">
              {events.map((eventName) => (
                <label className="check-field" key={eventName}>
                  <input
                    name={"event:" + eventName}
                    type="checkbox"
                  />
                  {eventName}
                </label>
              ))}
            </div>
            <button className="button button--primary" disabled={working === "webhook"}>
              Criar webhook
            </button>
          </form>
        ) : null}

        <div className="integration-list">
          {webhooks.map((webhook) => (
            <article key={webhook.id}>
              <div>
                <strong>{webhook.name}</strong>
                <small>{webhook.url}</small>
                <small>{webhook.events.join(" • ")}</small>
              </div>
              <span>{webhook._count.deliveries} entrega(s)</span>
              {webhook.active ? (
                <button
                  className="inline-action inline-action--danger"
                  type="button"
                  disabled={working === "webhooks:" + webhook.id}
                  onClick={() => void remove("webhooks", webhook.id)}
                >
                  Desativar
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
