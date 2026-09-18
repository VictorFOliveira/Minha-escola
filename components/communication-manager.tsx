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

type Communication = {
  id: string;
  title: string;
  content: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  audience: string;
  requiresAcknowledgement: boolean;
  requiresAuthorization: boolean;
  publishAt: string | null;
  expiresAt: string | null;
  author: { id: string; name: string; role: string };
  targetClass: { id: string; name: string; schoolYear: number } | null;
  attachments: Array<{ id: string; name: string; url: string }>;
  recipients: Array<{
    id: string;
    readAt: string | null;
    acknowledgedAt: string | null;
    deliveries: Array<{ channel: string; status: string }>;
  }>;
  authorizationRequests: Array<{
    id: string;
    status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";
  }>;
  _count: { recipients: number; authorizationRequests: number };
};

type Options = {
  classes: Array<{
    id: string;
    name: string;
    gradeLevel: string;
    schoolYear: number;
  }>;
  enrollments: Array<{
    id: string;
    student: { name: string; registration: string };
    class: { name: string; schoolYear: number };
  }>;
  guardians: Array<{
    id: string;
    name: string;
    phone: string;
    students: Array<{
      financialResponsible: boolean;
      student: { name: string };
    }>;
  }>;
};

type Settings = {
  portalEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  emailProvider: string | null;
  whatsappProvider: string | null;
};

const audienceLabels: Record<string, string> = {
  SCHOOL: "Escola inteira",
  STAFF: "Equipe interna",
  STUDENTS: "Todos os alunos",
  GUARDIANS: "Todos os responsáveis",
  FINANCIAL_GUARDIANS: "Responsáveis financeiros",
  CLASS_STUDENTS: "Alunos de uma turma",
  CLASS_GUARDIANS: "Responsáveis de uma turma",
  CLASS_BOTH: "Alunos + responsáveis da turma",
  INDIVIDUAL_STUDENT: "Aluno específico",
  INDIVIDUAL_GUARDIAN: "Responsável específico",
};

const priorityLabels = {
  NORMAL: "Normal",
  IMPORTANT: "Importante",
  URGENT: "Urgente",
};

export function CommunicationManager({
  role,
  canConfigure,
}: {
  role: Role;
  canConfigure: boolean;
}) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [options, setOptions] = useState<Options>({
    classes: [],
    enrollments: [],
    guardians: [],
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audience, setAudience] = useState("");
  const [attachmentEnabled, setAttachmentEnabled] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");

    try {
      const requests = [
        fetch("/api/communications", { cache: "no-store" }),
        fetch("/api/communications/options", { cache: "no-store" }),
      ];

      if (canConfigure) {
        requests.push(
          fetch("/api/communications/settings", { cache: "no-store" }),
        );
      }

      const responses = await Promise.all(requests);
      const data = await Promise.all(responses.map((item) => item.json()));

      if (!responses[0].ok) {
        setError(data[0].error || "Não foi possível carregar os comunicados.");
        return;
      }

      if (!responses[1].ok) {
        setError(data[1].error || "Não foi possível carregar os destinatários.");
        return;
      }

      setCommunications(data[0].communications || []);
      setOptions(data[1]);

      if (canConfigure && responses[2]?.ok) {
        setSettings(data[2].settings);
      }
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const allowedAudiences = useMemo(() => {
    if (role === "TEACHER") {
      return [
        "CLASS_STUDENTS",
        "CLASS_GUARDIANS",
        "CLASS_BOTH",
        "INDIVIDUAL_STUDENT",
        "INDIVIDUAL_GUARDIAN",
      ];
    }

    if (role === "FINANCE") {
      return ["FINANCIAL_GUARDIANS", "INDIVIDUAL_GUARDIAN"];
    }

    return Object.keys(audienceLabels);
  }, [role]);

  const needsClass = [
    "CLASS_STUDENTS",
    "CLASS_GUARDIANS",
    "CLASS_BOTH",
  ].includes(audience);
  const needsEnrollment = audience === "INDIVIDUAL_STUDENT";
  const needsGuardian = audience === "INDIVIDUAL_GUARDIAN";

  async function createCommunication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    setWorking("create");
    setError("");
    setMessage("");

    const attachments =
      attachmentEnabled &&
      String(form.get("attachmentName") || "").trim() &&
      String(form.get("attachmentUrl") || "").trim()
        ? [
            {
              name: String(form.get("attachmentName") || ""),
              url: String(form.get("attachmentUrl") || ""),
            },
          ]
        : [];

    try {
      const response = await fetch("/api/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") || ""),
          content: String(form.get("content") || ""),
          priority: String(form.get("priority") || "NORMAL"),
          audience: String(form.get("audience") || ""),
          targetClassId: String(form.get("targetClassId") || ""),
          targetEnrollmentId: String(form.get("targetEnrollmentId") || ""),
          targetGuardianId: String(form.get("targetGuardianId") || ""),
          requiresAcknowledgement:
            form.get("requiresAcknowledgement") === "on",
          requiresAuthorization:
            form.get("requiresAuthorization") === "on",
          expiresAt: String(form.get("expiresAt") || ""),
          attachments,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar o comunicado.");
        return;
      }

      event.currentTarget.reset();
      setAudience("");
      setAttachmentEnabled(false);
      setComposerOpen(false);
      setMessage("Comunicado salvo como rascunho.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function publish(id: string) {
    setWorking("publish:" + id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/communications/" + id + "/publish",
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível publicar o comunicado.");
        return;
      }

      setMessage(
        "Comunicado publicado para " + data.recipients + " destinatário(s).",
      );
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function archive(id: string) {
    setWorking("archive:" + id);
    setError("");

    try {
      const response = await fetch("/api/communications/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível arquivar.");
        return;
      }

      setMessage("Comunicado arquivado.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canConfigure) return;

    const form = new FormData(event.currentTarget);
    setWorking("settings");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/communications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portalEnabled: form.get("portalEnabled") === "on",
          emailEnabled: form.get("emailEnabled") === "on",
          whatsappEnabled: form.get("whatsappEnabled") === "on",
          emailProvider: String(form.get("emailProvider") || ""),
          whatsappProvider: String(form.get("whatsappProvider") || ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar os canais.");
        return;
      }

      setSettingsOpen(false);
      setMessage("Canais atualizados.");
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="communication-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FASE 9 • COMUNICAÇÃO</span>
          <h2>Central de comunicação</h2>
          <p>
            Avisos por público, leitura, ciência, anexos, autorizações e canais
            externos opcionais.
          </p>
        </div>

        <div className="communication-heading-actions">
          {canConfigure ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setSettingsOpen((value) => !value)}
            >
              Canais
            </button>
          ) : null}
          <button
            className="button button--primary"
            type="button"
            onClick={() => setComposerOpen((value) => !value)}
          >
            + Comunicado
          </button>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      {canConfigure && settingsOpen && settings ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CANAIS</span>
              <h2>Entrega de notificações</h2>
            </div>
          </div>

          <form className="communication-settings-form" onSubmit={saveSettings}>
            <label className="check-field">
              <input
                name="portalEnabled"
                type="checkbox"
                defaultChecked={settings.portalEnabled}
              />
              Portal
            </label>
            <label className="check-field">
              <input
                name="emailEnabled"
                type="checkbox"
                defaultChecked={settings.emailEnabled}
              />
              E-mail
            </label>
            <label>
              Provedor de e-mail
              <input
                name="emailProvider"
                defaultValue={settings.emailProvider || ""}
                placeholder="Ex.: Resend, SES..."
              />
            </label>
            <label className="check-field">
              <input
                name="whatsappEnabled"
                type="checkbox"
                defaultChecked={settings.whatsappEnabled}
              />
              WhatsApp
            </label>
            <label>
              Provedor de WhatsApp
              <input
                name="whatsappProvider"
                defaultValue={settings.whatsappProvider || ""}
                placeholder="Ex.: Meta Cloud API"
              />
            </label>
            <button className="button button--primary" disabled={working === "settings"}>
              Salvar canais
            </button>
          </form>

          <p className="communication-note">
            Portal funciona sem provedor externo. E-mail e WhatsApp entram na fila
            como pendentes quando habilitados; o conector específico do provedor
            pode ser adicionado sem alterar os comunicados.
          </p>
        </section>
      ) : null}

      {composerOpen ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">NOVO COMUNICADO</span>
              <h2>Preparar publicação</h2>
            </div>
          </div>

          <form className="communication-form" onSubmit={createCommunication}>
            <label className="communication-field--wide">
              Título
              <input name="title" required maxLength={160} />
            </label>

            <label>
              Prioridade
              <select name="priority" defaultValue="NORMAL">
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">Importante</option>
                <option value="URGENT">Urgente</option>
              </select>
            </label>

            <label>
              Público
              <select
                name="audience"
                required
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
              >
                <option value="">Selecione...</option>
                {allowedAudiences.map((value) => (
                  <option key={value} value={value}>
                    {audienceLabels[value]}
                  </option>
                ))}
              </select>
            </label>

            {needsClass ? (
              <label>
                Turma
                <select name="targetClassId" required>
                  <option value="">Selecione...</option>
                  {options.classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.schoolYear} • {item.name} • {item.gradeLevel}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {needsEnrollment ? (
              <label>
                Aluno
                <select name="targetEnrollmentId" required>
                  <option value="">Selecione...</option>
                  {options.enrollments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.student.name} • {item.class.name} •{" "}
                      {item.class.schoolYear}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {needsGuardian ? (
              <label>
                Responsável
                <select name="targetGuardianId" required>
                  <option value="">Selecione...</option>
                  {options.guardians.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Validade
              <input name="expiresAt" type="date" />
            </label>

            <label className="communication-field--wide">
              Mensagem
              <textarea name="content" rows={7} required />
            </label>

            <label className="check-field">
              <input name="requiresAcknowledgement" type="checkbox" />
              Exigir confirmação de ciência
            </label>

            <label className="check-field">
              <input name="requiresAuthorization" type="checkbox" />
              Exigir autorização do responsável
            </label>

            <label className="check-field">
              <input
                type="checkbox"
                checked={attachmentEnabled}
                onChange={(event) => setAttachmentEnabled(event.target.checked)}
              />
              Adicionar documento/link
            </label>

            {attachmentEnabled ? (
              <>
                <label>
                  Nome do anexo
                  <input name="attachmentName" placeholder="Ex.: Regulamento" />
                </label>
                <label className="communication-field--wide">
                  URL do documento
                  <input
                    name="attachmentUrl"
                    type="url"
                    placeholder="https://..."
                  />
                </label>
              </>
            ) : null}

            <div className="communication-form-actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setComposerOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="button button--primary"
                disabled={working === "create"}
              >
                {working === "create" ? "Salvando..." : "Salvar rascunho"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">HISTÓRICO</span>
            <h2>Comunicados</h2>
          </div>
        </div>

        <div className="communication-admin-list">
          {communications.length ? (
            communications.map((item) => {
              const read = item.recipients.filter((recipient) => recipient.readAt).length;
              const acknowledged = item.recipients.filter(
                (recipient) => recipient.acknowledgedAt,
              ).length;
              const approved = item.authorizationRequests.filter(
                (request) => request.status === "APPROVED",
              ).length;
              const denied = item.authorizationRequests.filter(
                (request) => request.status === "DENIED",
              ).length;

              return (
                <article key={item.id}>
                  <div className="communication-admin-main">
                    <div className="communication-admin-title">
                      <span
                        className={
                          item.priority === "URGENT"
                            ? "communication-priority communication-priority--urgent"
                            : item.priority === "IMPORTANT"
                              ? "communication-priority communication-priority--important"
                              : "communication-priority"
                        }
                      >
                        {priorityLabels[item.priority]}
                      </span>
                      <strong>{item.title}</strong>
                    </div>
                    <p>{item.content}</p>
                    <small>
                      {audienceLabels[item.audience] || item.audience} •{" "}
                      {item.author.name}
                      {item.targetClass ? " • " + item.targetClass.name : ""}
                    </small>
                  </div>

                  <div className="communication-admin-metrics">
                    <span>
                      <b>{item._count.recipients}</b>
                      destinatários
                    </span>
                    <span>
                      <b>{read}</b>
                      lidos
                    </span>
                    {item.requiresAcknowledgement ? (
                      <span>
                        <b>{acknowledged}</b>
                        ciências
                      </span>
                    ) : null}
                    {item.requiresAuthorization ? (
                      <>
                        <span>
                          <b>{approved}</b>
                          autorizados
                        </span>
                        <span>
                          <b>{denied}</b>
                          negados
                        </span>
                      </>
                    ) : null}
                  </div>

                  <div className="communication-admin-actions">
                    <span
                      className={
                        item.status === "PUBLISHED"
                          ? "status-chip status-chip--success"
                          : item.status === "ARCHIVED"
                            ? "status-chip"
                            : "status-chip status-chip--warning"
                      }
                    >
                      {item.status === "DRAFT"
                        ? "Rascunho"
                        : item.status === "PUBLISHED"
                          ? "Publicado"
                          : "Arquivado"}
                    </span>

                    {item.status === "DRAFT" ? (
                      <button
                        className="button button--primary button--small"
                        type="button"
                        disabled={working === "publish:" + item.id}
                        onClick={() => void publish(item.id)}
                      >
                        Publicar
                      </button>
                    ) : null}

                    {item.status === "PUBLISHED" ? (
                      <button
                        className="inline-action"
                        type="button"
                        disabled={working === "archive:" + item.id}
                        onClick={() => void archive(item.id)}
                      >
                        Arquivar
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-records">
              <span>✉</span>
              <h3>Nenhum comunicado</h3>
              <p>Crie o primeiro aviso da escola.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
