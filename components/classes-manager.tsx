"use client";

import { FormEvent, useEffect, useState } from "react";

type Teacher = {
  id: string;
  name: string;
  specialty?: string | null;
};

type ClassItem = {
  id: string;
  name: string;
  gradeLevel: string;
  shift: string;
  room: string | null;
  capacity: number | null;
  schoolYear: number;
  teacherId: string | null;
  teacher: Teacher | null;
  _count: { enrollments: number };
};

export function ClassesManager({ canEdit }: { canEdit: boolean }) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

      const [classResponse, teacherResponse] = await Promise.all([
        fetch("/api/classes?" + query.toString(), { cache: "no-store" }),
        canEdit
          ? fetch("/api/teachers?all=1", { cache: "no-store" })
          : Promise.resolve(null),
      ]);

      const classData = await classResponse.json();
      if (!classResponse.ok) {
        setError(classData.error || "Não foi possível carregar as turmas.");
        return;
      }

      setClasses(classData.classes || []);
      if (classData.meta) setMeta(classData.meta);

      if (teacherResponse) {
        const teacherData = await teacherResponse.json();
        if (teacherResponse.ok) setTeachers(teacherData.teachers || []);
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
  }, [canEdit, page, search]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
    setError("");
  }

  function openEdit(item: ClassItem) {
    setEditing(item);
    setFormOpen(true);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      gradeLevel: String(form.get("gradeLevel") || ""),
      schoolYear: String(form.get("schoolYear") || ""),
      shift: String(form.get("shift") || ""),
      room: String(form.get("room") || ""),
      capacity: String(form.get("capacity") || ""),
      teacherId: String(form.get("teacherId") || ""),
    };

    try {
      const response = await fetch(
        editing ? "/api/classes/" + editing.id : "/api/classes",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar a turma.");
        return;
      }

      setEditing(null);
      setFormOpen(false);
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ClassItem) {
    if (!window.confirm("Excluir a turma " + item.name + "?")) return;

    const response = await fetch("/api/classes/" + item.id, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível excluir a turma.");
      return;
    }

    await load();
  }

  return (
    <div className="classes-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACADÊMICO</span>
          <h2>Turmas</h2>
          <p>Turmas reais por ano letivo, com professor, sala e capacidade.</p>
        </div>
        {canEdit ? (
          <button className="button button--primary" type="button" onClick={openCreate}>
            + Nova turma
          </button>
        ) : null}
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}

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
              placeholder="Buscar turma, série ou sala..."
            />
          </div>
          <span className="record-count">{meta.total} turmas</span>
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
      </section>

      {formOpen && canEdit ? (
        <section className="panel class-form-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{editing ? "EDIÇÃO" : "NOVA TURMA"}</span>
              <h2>{editing ? "Editar turma" : "Cadastrar turma"}</h2>
            </div>
            <button className="more-button" type="button" onClick={() => setFormOpen(false)}>✕</button>
          </div>

          <form className="class-form" onSubmit={submit} key={editing?.id || "new"}>
            <label>
              Nome da turma
              <input name="name" required defaultValue={editing?.name || ""} placeholder="Ex.: 7º A" />
            </label>
            <label>
              Série / etapa
              <input name="gradeLevel" required defaultValue={editing?.gradeLevel || ""} placeholder="Ex.: 7º ano" />
            </label>
            <label>
              Ano letivo
              <input name="schoolYear" type="number" min="2000" max="2100" required defaultValue={editing?.schoolYear || new Date().getFullYear()} />
            </label>
            <label>
              Turno
              <select name="shift" required defaultValue={editing?.shift || "Manhã"}>
                <option>Manhã</option>
                <option>Tarde</option>
                <option>Noite</option>
                <option>Integral</option>
              </select>
            </label>
            <label>
              Sala
              <input name="room" defaultValue={editing?.room || ""} placeholder="Ex.: Sala 08" />
            </label>
            <label>
              Capacidade
              <input name="capacity" type="number" min="1" defaultValue={editing?.capacity || ""} placeholder="Ex.: 30" />
            </label>
            <label className="class-field--wide">
              Professor responsável
              <select name="teacherId" defaultValue={editing?.teacherId || ""}>
                <option value="">Sem professor definido</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}{teacher.specialty ? " • " + teacher.specialty : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="class-form-actions">
              <button className="button button--secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</button>
              <button className="button button--primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar turma"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {loading ? (
        <div className="loading-state">Carregando turmas...</div>
      ) : classes.length === 0 ? (
        <section className="panel empty-records">
          <span>＋</span>
          <h3>Nenhuma turma cadastrada</h3>
          <p>Cadastre a primeira turma para começar as matrículas.</p>
        </section>
      ) : (
        <section className="class-grid">
          {classes.map((item) => {
            const enrolled = item._count.enrollments;
            const capacityText = item.capacity ? enrolled + "/" + item.capacity : String(enrolled);
            const isFull = item.capacity ? enrolled >= item.capacity : false;

            return (
              <article className="class-card class-card--real" key={item.id}>
                <div className="class-card-top">
                  <span className="class-badge">{item.name}</span>
                  <span className="year-badge">{item.schoolYear}</span>
                </div>
                <h3>{item.teacher?.name || "Professor não definido"}</h3>
                <p>{item.teacher?.specialty || item.gradeLevel}</p>
                <div className="class-meta">
                  <span>
                    <strong>{capacityText}</strong>
                    {item.capacity ? "matrículas / vagas" : "matrículas"}
                  </span>
                  <span>
                    <strong>{item.room || "—"}</strong>
                    sala
                  </span>
                  <span>
                    <strong>{item.shift}</strong>
                    turno
                  </span>
                </div>
                {item.capacity ? (
                  <div className="capacity-track">
                    <span style={{ width: Math.min(100, (enrolled / item.capacity) * 100) + "%" }} />
                  </div>
                ) : null}
                <div className="class-footer">
                  <span className={isFull ? "status-chip status-chip--warning" : "status-chip status-chip--success"}>
                    {isFull ? "Lotada" : "Disponível"}
                  </span>
                  {canEdit ? (
                    <span className="class-actions">
                      <button className="inline-action" type="button" onClick={() => openEdit(item)}>Editar</button>
                      <button className="inline-action inline-action--danger" type="button" onClick={() => void remove(item)}>Excluir</button>
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
