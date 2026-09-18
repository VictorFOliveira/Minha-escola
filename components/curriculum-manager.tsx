"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Subject = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
};

type CurriculumLine = {
  id: string;
  weeklyClasses: number | null;
  workloadHours: number | null;
  subject: Subject;
};

type Curriculum = {
  id: string;
  name: string;
  gradeLevel: string;
  schoolYear: number;
  active: boolean;
  subjects: CurriculumLine[];
  _count: { classes: number };
};

type DraftLine = {
  subjectId: string;
  weeklyClasses: string;
  workloadHours: string;
};

export function CurriculumManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [subjectResponse, curriculumResponse] = await Promise.all([
        fetch("/api/subjects", { cache: "no-store" }),
        fetch("/api/curricula", { cache: "no-store" }),
      ]);
      const [subjectData, curriculumData] = await Promise.all([
        subjectResponse.json(),
        curriculumResponse.json(),
      ]);

      if (!subjectResponse.ok) {
        setError(subjectData.error || "Não foi possível carregar as disciplinas.");
        return;
      }
      if (!curriculumResponse.ok) {
        setError(curriculumData.error || "Não foi possível carregar as grades.");
        return;
      }

      setSubjects((subjectData.subjects || []).filter((item: Subject) => item.active));
      setCurricula(curriculumData.curricula || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const availableSubjects = useMemo(
    () => subjects.filter((subject) => !lines.some((line) => line.subjectId === subject.id)),
    [subjects, lines],
  );

  function addSubject(subjectId: string) {
    if (!subjectId) return;

    setLines((current) => [
      ...current,
      {
        subjectId,
        weeklyClasses: "",
        workloadHours: "",
      },
    ]);
  }

  function updateLine(index: number, changes: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...changes } : line,
      ),
    );
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function createCurriculum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!lines.length) {
      setError("Adicione pelo menos uma disciplina à grade.");
      return;
    }

    setSaving(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/curricula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          gradeLevel: String(form.get("gradeLevel") || ""),
          schoolYear: String(form.get("schoolYear") || ""),
          subjects: lines,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível criar a grade curricular.");
        return;
      }

      event.currentTarget.reset();
      setLines([]);
      setFormOpen(false);
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCurriculum(item: Curriculum) {
    const response = await fetch("/api/curricula/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível alterar a grade.");
      return;
    }

    await load();
  }

  async function removeCurriculum(item: Curriculum) {
    if (!window.confirm("Excluir a grade " + item.name + "?")) return;

    const response = await fetch("/api/curricula/" + item.id, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível excluir a grade.");
      return;
    }

    await load();
  }

  return (
    <section className="panel curriculum-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">GRADE CURRICULAR</span>
          <h2>Disciplinas por série e ano letivo</h2>
        </div>
        <button
          className="button button--primary button--small"
          type="button"
          onClick={() => setFormOpen((value) => !value)}
        >
          + Nova grade
        </button>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}

      {formOpen ? (
        <form className="curriculum-form" onSubmit={createCurriculum}>
          <label>
            Nome da grade
            <input name="name" required placeholder="Ex.: Grade 7º ano 2027" />
          </label>
          <label>
            Série / etapa
            <input name="gradeLevel" required placeholder="Ex.: 7º ano" />
          </label>
          <label>
            Ano letivo
            <input
              name="schoolYear"
              type="number"
              min="2000"
              max="2100"
              required
              defaultValue={new Date().getFullYear()}
            />
          </label>

          <div className="curriculum-builder">
            <div className="curriculum-add-line">
              <select
                defaultValue=""
                onChange={(event) => {
                  addSubject(event.target.value);
                  event.target.value = "";
                }}
              >
                <option value="">Adicionar disciplina...</option>
                {availableSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            {lines.map((line, index) => {
              const subject = subjects.find((item) => item.id === line.subjectId);

              return (
                <div className="curriculum-line" key={line.subjectId}>
                  <strong>{subject?.name || "Disciplina"}</strong>
                  <label>
                    Aulas/semana
                    <input
                      type="number"
                      min="1"
                      value={line.weeklyClasses}
                      onChange={(event) =>
                        updateLine(index, { weeklyClasses: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Carga horária anual
                    <input
                      type="number"
                      min="1"
                      value={line.workloadHours}
                      onChange={(event) =>
                        updateLine(index, { workloadHours: event.target.value })
                      }
                    />
                  </label>
                  <button
                    className="inline-action inline-action--danger"
                    type="button"
                    onClick={() => removeLine(index)}
                  >
                    Remover
                  </button>
                </div>
              );
            })}
          </div>

          <div className="curriculum-form-actions">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setFormOpen(false);
                setLines([]);
              }}
            >
              Cancelar
            </button>
            <button className="button button--primary" disabled={saving}>
              {saving ? "Salvando..." : "Criar grade curricular"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="loading-state">Carregando grades...</div>
      ) : curricula.length === 0 ? (
        <div className="empty-records">
          <span>＋</span>
          <h3>Nenhuma grade curricular</h3>
          <p>Crie uma grade para depois aplicá-la às turmas.</p>
        </div>
      ) : (
        <div className="curriculum-grid">
          {curricula.map((item) => (
            <article className="curriculum-card" key={item.id}>
              <div className="curriculum-card-head">
                <div>
                  <span className="eyebrow">
                    {item.gradeLevel} • {item.schoolYear}
                  </span>
                  <h3>{item.name}</h3>
                </div>
                <span
                  className={
                    item.active
                      ? "status-chip status-chip--success"
                      : "status-chip status-chip--warning"
                  }
                >
                  {item.active ? "Ativa" : "Inativa"}
                </span>
              </div>

              <div className="curriculum-subject-list">
                {item.subjects.map((line) => (
                  <div key={line.id}>
                    <strong>{line.subject.name}</strong>
                    <span>
                      {line.weeklyClasses
                        ? line.weeklyClasses + " aulas/semana"
                        : "Aulas semanais não definidas"}
                    </span>
                    <small>
                      {line.workloadHours
                        ? line.workloadHours + "h/ano"
                        : "Carga horária não definida"}
                    </small>
                  </div>
                ))}
              </div>

              <div className="curriculum-card-footer">
                <span>{item._count.classes} turma(s) usando esta grade</span>
                <div className="mini-actions">
                  <button
                    className="inline-action"
                    type="button"
                    onClick={() => void toggleCurriculum(item)}
                  >
                    {item.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    className="inline-action inline-action--danger"
                    type="button"
                    onClick={() => void removeCurriculum(item)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
