"use client";

import { useEffect, useState } from "react";

type SessionItem = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
  mfaVerified: boolean;
  impersonatedByPlatformAdminId?: string | null;
  supportReason?: string | null;
};

type SecurityEvent = {
  id: string;
  eventType: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  requestId: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
  user?: { name: string; email: string } | null;
};

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Dispositivo não identificado";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad/i.test(userAgent)) return "iPhone / iPad";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Macintosh|Mac OS/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Navegador";
}

export function SecurityCenter({
  platform = false,
}: {
  platform?: boolean;
}) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  const base = platform
    ? "/api/platform/security"
    : "/api/security";

  async function load() {
    setError("");

    try {
      const [sessionsResponse, eventsResponse] = await Promise.all([
        fetch(base + "/sessions", { cache: "no-store" }),
        fetch(base + "/events", { cache: "no-store" }),
      ]);

      const [sessionsData, eventsData] = await Promise.all([
        sessionsResponse.json(),
        eventsResponse.json(),
      ]);

      if (!sessionsResponse.ok || !eventsResponse.ok) {
        setError(
          sessionsData.error ||
            eventsData.error ||
            "Não foi possível carregar a segurança da conta.",
        );
        return;
      }

      setSessions(sessionsData.sessions || []);
      setCurrentSessionId(sessionsData.currentSessionId || "");
      setEvents(eventsData.events || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void load();
  }, [platform]);

  async function revoke(sessionId: string) {
    setWorking(sessionId);
    setError("");

    try {
      const response = await fetch(base + "/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível encerrar a sessão.");
        return;
      }

      if (sessionId === currentSessionId) {
        window.location.href = platform
          ? "/superadmin/login"
          : "/login";
        return;
      }

      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function revokeOthers() {
    setWorking("others");
    setError("");

    try {
      const response = await fetch(
        base + "/sessions/revoke-others",
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Não foi possível encerrar as outras sessões.",
        );
        return;
      }

      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="security-center">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEGURANÇA DA CONTA</span>
          <h2>Sessões & eventos</h2>
          <p>
            Revogue dispositivos imediatamente e acompanhe eventos sensíveis
            da sua conta.
          </p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          disabled={working === "others"}
          onClick={() => void revokeOthers()}
        >
          Encerrar outras sessões
        </button>
      </div>

      {error ? (
        <div className="form-alert form-alert--error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">DISPOSITIVOS</span>
            <h2>Sessões ativas</h2>
          </div>
        </div>

        <div className="security-session-list">
          {sessions.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{deviceLabel(item.userAgent)}</strong>
                <small>
                  Última atividade{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(item.lastSeenAt))}
                </small>
                <small>
                  Expira{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(item.expiresAt))}
                </small>
                {item.supportReason ? (
                  <span className="status-chip status-chip--warning">
                    Modo suporte: {item.supportReason}
                  </span>
                ) : null}
              </div>
              <div className="security-session-state">
                {item.id === currentSessionId ? (
                  <span className="status-chip status-chip--success">
                    Sessão atual
                  </span>
                ) : null}
                {item.mfaVerified ? (
                  <span className="status-chip">MFA ✓</span>
                ) : null}
                <button
                  className="inline-action inline-action--danger"
                  type="button"
                  disabled={working === item.id}
                  onClick={() => void revoke(item.id)}
                >
                  Encerrar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">HISTÓRICO</span>
            <h2>Eventos de segurança</h2>
          </div>
        </div>

        <div className="security-event-list">
          {events.map((event) => (
            <article key={event.id}>
              <span
                className={
                  event.severity === "CRITICAL"
                    ? "security-severity security-severity--critical"
                    : event.severity === "WARN"
                      ? "security-severity security-severity--warn"
                      : "security-severity"
                }
              >
                {event.severity}
              </span>
              <div>
                <strong>{event.eventType}</strong>
                {event.user ? (
                  <small>
                    {event.user.name} • {event.user.email}
                  </small>
                ) : null}
                <small>
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(event.createdAt))}
                  {event.requestId
                    ? " • request " + event.requestId
                    : ""}
                </small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
