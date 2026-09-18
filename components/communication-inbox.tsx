"use client";

import { useEffect, useMemo, useState } from "react";

type Delivery = {
  channel: "PORTAL" | "EMAIL" | "WHATSAPP";
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
};

type InboxItem = {
  id: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  communication: {
    id: string;
    title: string;
    content: string;
    priority: "NORMAL" | "IMPORTANT" | "URGENT";
    requiresAcknowledgement: boolean;
    requiresAuthorization: boolean;
    publishAt: string | null;
    expiresAt: string | null;
    author: {
      id: string;
      name: string;
      role: string;
    };
    targetClass: {
      id: string;
      name: string;
      schoolYear: number;
    } | null;
    attachments: Array<{
      id: string;
      name: string;
      url: string;
      mimeType: string | null;
    }>;
  };
  deliveries: Delivery[];
};

type Authorization = {
  id: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";
  responseNote: string | null;
  respondedAt: string | null;
  student: {
    id: string;
    name: string;
    registration: string;
  };
  communication: {
    id: string;
    title: string;
    content: string;
    expiresAt: string | null;
    attachments: Array<{
      id: string;
      name: string;
      url: string;
    }>;
  };
};

const priorityLabels = {
  NORMAL: "Comunicado",
  IMPORTANT: "Importante",
  URGENT: "Urgente",
};

const authorizationLabels = {
  PENDING: "Aguardando resposta",
  APPROVED: "Autorizado",
  DENIED: "Não autorizado",
  EXPIRED: "Prazo encerrado",
};

export function CommunicationInbox({
  title = "Comunicados da escola",
}: {
  title?: string;
}) {
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [unread, setUnread] = useState(0);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/communications/inbox", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível carregar os comunicados.");
        return;
      }

      setInbox(data.inbox || []);
      setAuthorizations(data.authorizations || []);
      setUnread(Number(data.unread || 0));
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const pendingAuthorizations = useMemo(
    () =>
      authorizations.filter(
        (item) => item.status === "PENDING",
      ).length,
    [authorizations],
  );

  async function openItem(item: InboxItem) {
    setOpenIds((current) => {
      const next = new Set(current);
      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
      return next;
    });

    if (item.readAt) return;

    const response = await fetch(
      "/api/communications/inbox/" + item.id + "/read",
      { method: "POST" },
    );

    if (response.ok) {
      await load();
    }
  }

  async function acknowledge(item: InboxItem) {
    setWorking("ack:" + item.id);
    setError("");

    try {
      const response = await fetch(
        "/api/communications/inbox/" +
          item.id +
          "/acknowledge",
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Não foi possível confirmar a leitura.",
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

  async function respondAuthorization(
    authorization: Authorization,
    status: "APPROVED" | "DENIED",
  ) {
    const note =
      window.prompt(
        status === "APPROVED"
          ? "Observação opcional da autorização:"
          : "Motivo/observação opcional:",
      ) || "";

    setWorking("auth:" + authorization.id);
    setError("");

    try {
      const response = await fetch(
        "/api/communications/authorizations/" +
          authorization.id +
          "/respond",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            responseNote: note,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Não foi possível responder à autorização.",
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
    <section className="portal-panel communication-inbox">
      <div className="portal-panel-heading portal-panel-heading--split">
        <div>
          <span className="eyebrow">COMUNICAÇÃO</span>
          <h2>{title}</h2>
        </div>
        <div className="communication-inbox-badges">
          {unread ? <span>{unread} não lido(s)</span> : null}
          {pendingAuthorizations ? (
            <span>{pendingAuthorizations} autorização(ões)</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="form-alert form-alert--error">{error}</div>
      ) : null}

      {authorizations.length ? (
        <div className="authorization-list">
          {authorizations.map((authorization) => (
            <article
              className={
                authorization.status === "PENDING"
                  ? "authorization-card authorization-card--pending"
                  : "authorization-card"
              }
              key={authorization.id}
            >
              <div>
                <span className="eyebrow">AUTORIZAÇÃO</span>
                <strong>{authorization.communication.title}</strong>
                <small>
                  Aluno: {authorization.student.name} •{" "}
                  {authorization.student.registration}
                </small>
                <p className="authorization-content">
                  {authorization.communication.content}
                </p>
                {authorization.communication.attachments.length ? (
                  <div className="communication-attachments">
                    {authorization.communication.attachments.map((attachment) => (
                      <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">
                        ↗ {attachment.name}
                      </a>
                    ))}
                  </div>
                ) : null}
                {authorization.communication.expiresAt ? (
                  <small>
                    Prazo:{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(
                        authorization.communication.expiresAt,
                      ),
                    )}
                  </small>
                ) : null}
              </div>

              <span
                className={
                  authorization.status === "APPROVED"
                    ? "status-chip status-chip--success"
                    : authorization.status === "DENIED" ||
                        authorization.status === "EXPIRED"
                      ? "status-chip report-status--failed"
                      : "status-chip status-chip--warning"
                }
              >
                {authorizationLabels[authorization.status]}
              </span>

              {authorization.status === "PENDING" ? (
                <div className="authorization-actions">
                  <button
                    className="button button--secondary button--small"
                    type="button"
                    disabled={
                      working === "auth:" + authorization.id
                    }
                    onClick={() =>
                      void respondAuthorization(
                        authorization,
                        "DENIED",
                      )
                    }
                  >
                    Não autorizar
                  </button>
                  <button
                    className="button button--primary button--small"
                    type="button"
                    disabled={
                      working === "auth:" + authorization.id
                    }
                    onClick={() =>
                      void respondAuthorization(
                        authorization,
                        "APPROVED",
                      )
                    }
                  >
                    Autorizar
                  </button>
                </div>
              ) : null}

              {authorization.responseNote ? (
                <p>{authorization.responseNote}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      <div className="communication-message-list">
        {inbox.length ? (
          inbox.map((item) => {
            const isOpen = openIds.has(item.id);

            return (
              <article
                className={
                  item.readAt
                    ? "communication-message"
                    : "communication-message communication-message--unread"
                }
                key={item.id}
              >
                <button
                  className="communication-message-head"
                  type="button"
                  onClick={() => void openItem(item)}
                >
                  <span
                    className={
                      item.communication.priority === "URGENT"
                        ? "communication-priority communication-priority--urgent"
                        : item.communication.priority === "IMPORTANT"
                          ? "communication-priority communication-priority--important"
                          : "communication-priority"
                    }
                  >
                    {priorityLabels[item.communication.priority]}
                  </span>
                  <span className="communication-title-copy">
                    <strong>{item.communication.title}</strong>
                    <small>
                      {item.communication.author.name}
                      {item.communication.targetClass
                        ? " • " +
                          item.communication.targetClass.name
                        : ""}
                      {item.communication.publishAt
                        ? " • " +
                          new Intl.DateTimeFormat("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }).format(
                            new Date(
                              item.communication.publishAt,
                            ),
                          )
                        : ""}
                    </small>
                  </span>
                  {!item.readAt ? (
                    <i className="communication-unread-dot" />
                  ) : null}
                  <span>{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen ? (
                  <div className="communication-message-body">
                    <p>{item.communication.content}</p>

                    {item.communication.attachments.length ? (
                      <div className="communication-attachments">
                        {item.communication.attachments.map(
                          (attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ↗ {attachment.name}
                            </a>
                          ),
                        )}
                      </div>
                    ) : null}

                    {item.communication.requiresAcknowledgement ? (
                      <div className="communication-acknowledgement">
                        {item.acknowledgedAt ? (
                          <span>
                            ✓ Ciência confirmada em{" "}
                            {new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(
                              new Date(item.acknowledgedAt),
                            )}
                          </span>
                        ) : (
                          <button
                            className="button button--primary button--small"
                            type="button"
                            disabled={
                              working === "ack:" + item.id
                            }
                            onClick={() =>
                              void acknowledge(item)
                            }
                          >
                            Confirmar ciência
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="portal-empty">
            Nenhum comunicado disponível no momento.
          </div>
        )}
      </div>
    </section>
  );
}
