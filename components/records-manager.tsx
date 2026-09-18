"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Kind = "students" | "guardians" | "teachers" | "employees";
type Item = Record<string, any>;

type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "date";
  required?: boolean;
  placeholder?: string;
};

const config: Record<Kind, {
  title: string;
  eyebrow: string;
  description: string;
  endpoint: string;
  responseKey: string;
  singular: string;
  fields: Field[];
  secondary: (item: Item) => string;
}> = {
  students: {
    title: "Alunos",
    eyebrow: "SECRETARIA",
    description: "Cadastro real de alunos armazenado no PostgreSQL.",
    endpoint: "/api/students",
    responseKey: "students",
    singular: "aluno",
    fields: [
      { name: "registration", label: "Matrícula", required: true },
      { name: "name", label: "Nome completo", required: true },
      { name: "birthDate", label: "Nascimento", type: "date" },
      { name: "document", label: "CPF / documento" },
      { name: "phone", label: "Telefone" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "address", label: "Endereço" },
    ],
    secondary: (item) => "Matrícula " + item.registration,
  },
  guardians: {
    title: "Responsáveis",
    eyebrow: "SECRETARIA",
    description: "Responsáveis e vínculos familiares dos alunos.",
    endpoint: "/api/guardians",
    responseKey: "guardians",
    singular: "responsável",
    fields: [
      { name: "name", label: "Nome completo", required: true },
      { name: "document", label: "CPF / documento" },
      { name: "phone", label: "Telefone", required: true },
      { name: "email", label: "E-mail", type: "email" },
      { name: "address", label: "Endereço" },
    ],
    secondary: (item) => item.phone || "Sem telefone",
  },
  teachers: {
    title: "Professores",
    eyebrow: "EQUIPE",
    description: "Cadastro de docentes, especialidades e situação cadastral.",
    endpoint: "/api/teachers",
    responseKey: "teachers",
    singular: "professor",
    fields: [
      { name: "name", label: "Nome completo", required: true },
      { name: "document", label: "CPF / documento" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "phone", label: "Telefone" },
      { name: "specialty", label: "Especialidade / disciplina" },
    ],
    secondary: (item) => item.specialty || "Especialidade não informada",
  },
  employees: {
    title: "Funcionários",
    eyebrow: "EQUIPE",
    description: "Equipe administrativa e operacional da instituição.",
    endpoint: "/api/employees",
    responseKey: "employees",
    singular: "funcionário",
    fields: [
      { name: "name", label: "Nome completo", required: true },
      { name: "jobTitle", label: "Cargo", required: true },
      { name: "department", label: "Setor" },
      { name: "document", label: "CPF / documento" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "phone", label: "Telefone" },
      { name: "hiredAt", label: "Admissão", type: "date" },
    ],
    secondary: (item) => [item.jobTitle, item.department].filter(Boolean).join(" • "),
  },
};

function normalizeDate(value: unknown) {
  if (!value || typeof value !== "string") return "";
  return value.slice(0, 10);
}

export function RecordsManager({ kind }: { kind: Kind }) {
  const cfg = config[kind];
  const [items, setItems] = useState<Item[]>([]);
  const [students, setStudents] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [linking, setLinking] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    pages: 1,
  });

  async function load() {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: "50",
      });
      if (search.trim()) query.set("search", search.trim());

      const response = await fetch(cfg.endpoint + "?" + query.toString(), {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível carregar os registros.");
        return;
      }

      setItems(data[cfg.responseKey] || []);
      if (data.meta) setMeta(data.meta);

      if (kind === "guardians") {
        const studentResponse = await fetch("/api/students?all=1", { cache: "no-store" });
        const studentData = await studentResponse.json();
        if (studentResponse.ok) setStudents(studentData.students || []);
      }
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);

    return () => window.clearTimeout(timer);
  }, [kind, page, search]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) =>
      [item.name, item.email, item.phone, item.registration, item.document, item.jobTitle]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
    setError("");
  }

  function openEdit(item: Item) {
    setEditing(item);
    setFormOpen(true);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {};

    for (const field of cfg.fields) {
      payload[field.name] = String(form.get(field.name) || "");
    }

    const endpoint = editing ? cfg.endpoint + "/" + editing.id : cfg.endpoint;

    try {
      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar o registro.");
        return;
      }

      setFormOpen(false);
      setEditing(null);
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: Item) {
    const response = await fetch(cfg.endpoint + "/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Não foi possível alterar o status.");
      return;
    }

    await load();
  }

  async function remove(item: Item) {
    if (!window.confirm("Excluir definitivamente " + item.name + "?")) return;

    const response = await fetch(cfg.endpoint + "/" + item.id, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível excluir o registro.");
      return;
    }

    await load();
  }

  async function linkStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linking) return;

    const form = new FormData(event.currentTarget);
    const payload = {
      studentId: String(form.get("studentId") || ""),
      relationship: String(form.get("relationship") || ""),
      financialResponsible: form.get("financialResponsible") === "on",
      authorizedPickup: form.get("authorizedPickup") === "on",
    };

    const response = await fetch("/api/guardians/" + linking.id + "/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Não foi possível vincular o aluno.");
      return;
    }

    setLinking(null);
    await load();
  }

  return (
    <div className="records-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{cfg.eyebrow}</span>
          <h2>{cfg.title}</h2>
          <p>{cfg.description}</p>
        </div>
        <button className="button button--primary" type="button" onClick={openCreate}>
          + Cadastrar {cfg.singular}
        </button>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}

      {formOpen ? (
        <section className="panel record-form-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{editing ? "EDIÇÃO" : "NOVO CADASTRO"}</span>
              <h2>{editing ? "Editar " + cfg.singular : "Cadastrar " + cfg.singular}</h2>
            </div>
            <button className="more-button" type="button" onClick={() => setFormOpen(false)}>✕</button>
          </div>

          <form className="record-form" onSubmit={submit} key={editing?.id || "new"}>
            {cfg.fields.map((field) => (
              <label key={field.name} className={field.name === "address" ? "record-field--wide" : ""}>
                {field.label}
                <input
                  name={field.name}
                  type={field.type || "text"}
                  required={field.required}
                  defaultValue={
                    field.type === "date"
                      ? normalizeDate(editing?.[field.name])
                      : editing?.[field.name] || ""
                  }
                  placeholder={field.placeholder}
                />
              </label>
            ))}
            <div className="record-form-actions">
              <button className="button button--secondary" type="button" onClick={() => setFormOpen(false)}>
                Cancelar
              </button>
              <button className="button button--primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar cadastro"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {linking ? (
        <section className="panel relation-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">VÍNCULO FAMILIAR</span>
              <h2>Vincular aluno a {linking.name}</h2>
            </div>
            <button className="more-button" type="button" onClick={() => setLinking(null)}>✕</button>
          </div>
          <form className="relation-form" onSubmit={linkStudent}>
            <label>
              Aluno
              <select name="studentId" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} • {student.registration}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Parentesco / vínculo
              <input name="relationship" required placeholder="Ex.: Mãe, Pai, Avó" />
            </label>
            <label className="check-field">
              <input name="financialResponsible" type="checkbox" />
              Responsável financeiro
            </label>
            <label className="check-field">
              <input name="authorizedPickup" type="checkbox" defaultChecked />
              Autorizado a retirar o aluno
            </label>
            <button className="button button--primary">Salvar vínculo</button>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="toolbar">
          <div className="search-box">
            ⌕
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={"Buscar em " + cfg.title.toLowerCase() + "..."}
            />
          </div>
          <span className="record-count">{meta.total} registros</span>
          {meta.pages > 1 ? (
            <div className="mini-actions">
              <button
                className="inline-action"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Anterior
              </button>
              <span className="muted-small">
                {meta.page}/{meta.pages}
              </span>
              <button
                className="inline-action"
                type="button"
                disabled={page >= meta.pages}
                onClick={() =>
                  setPage((value) => Math.min(meta.pages, value + 1))
                }
              >
                Próxima
              </button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="loading-state">Carregando dados...</div>
        ) : visibleItems.length === 0 ? (
          <div className="empty-records">
            <span>＋</span>
            <h3>Nenhum registro encontrado</h3>
            <p>Cadastre o primeiro registro para começar a usar este módulo.</p>
          </div>
        ) : (
          <div className="records-list">
            {visibleItems.map((item) => (
              <article className="record-row" key={item.id}>
                <div className="avatar">
                  {String(item.name || "?").split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                </div>
                <div className="record-main">
                  <strong>{item.name}</strong>
                  <span>{cfg.secondary(item)}</span>
                  {kind === "guardians" && item.students?.length ? (
                    <small>
                      {item.students.map((link: any) => link.student?.name).filter(Boolean).join(", ")}
                    </small>
                  ) : null}
                </div>
                <div className="record-contact">
                  <span>{item.email || "—"}</span>
                  <span>{item.phone || "—"}</span>
                </div>
                <span className={item.status === "INACTIVE" ? "status-chip status-chip--warning" : "status-chip status-chip--success"}>
                  {item.status === "INACTIVE" ? "Inativo" : "Ativo"}
                </span>
                <div className="record-actions">
                  {kind === "guardians" ? (
                    <button className="inline-action" type="button" onClick={() => setLinking(item)}>Vincular aluno</button>
                  ) : null}
                  <button className="inline-action" type="button" onClick={() => openEdit(item)}>Editar</button>
                  <button className="inline-action" type="button" onClick={() => void toggleStatus(item)}>
                    {item.status === "INACTIVE" ? "Ativar" : "Desativar"}
                  </button>
                  <button className="inline-action inline-action--danger" type="button" onClick={() => void remove(item)}>Excluir</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
