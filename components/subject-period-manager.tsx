"use client";

import { FormEvent, useEffect, useState } from "react";

type Subject = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  _count?: {
    curriculumSubjects: number;
    classSubjects: number;
  };
};

type Period = {
  id: string;
  schoolYear: number;
  name: string;
  order: number;
  startDate: string;
  endDate: string;
  weight: string | number;
  status: "PLANNED" | "ACTIVE" | "CLOSED";
};

export function SubjectPeriodManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [subjectResponse, periodResponse] = await Promise.all([
        fetch("/api/subjects", { cache: "no-store" }),
        fetch("/api/academic-periods", { cache: "no-store" }),
      ]);
      const [subjectData, periodData] = await Promise.all([
        subjectResponse.json(),
        periodResponse.json(),
      ]);

      if (!subjectResponse.ok) {
        setError(subjectData.error || "Não foi possível carregar as disciplinas.");
        return;
      }
      if (!periodResponse.ok) {
        setError(periodData.error || "Não foi possível carregar os períodos.");
        return;
      }

      setSubjects(subjectData.subjects || []);
      setPeriods(periodData.periods || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") || ""),
        code: String(form.get("code") || ""),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível criar a disciplina.");
      return;
    }

    event.currentTarget.reset();
    setSubjectOpen(false);
    setMessage("Disciplina criada.");
    await load();
  }

  async function toggleSubject(item: Subject) {
    const response = await fetch("/api/subjects/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível alterar a disciplina.");
      return;
    }

    await load();
  }

  async function deleteSubject(item: Subject) {
    if (!window.confirm("Excluir a disciplina " + item.name + "?")) return;

    const response = await fetch("/api/subjects/" + item.id, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível excluir a disciplina.");
      return;
    }

    await load();
  }

  async function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/academic-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolYear: String(form.get("schoolYear") || ""),
        order: String(form.get("order") || ""),
        name: String(form.get("name") || ""),
        startDate: String(form.get("startDate") || ""),
        endDate: String(form.get("endDate") || ""),
        weight: String(form.get("weight") || "1"),
        status: String(form.get("status") || "PLANNED"),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível criar o período.");
      return;
    }

    event.currentTarget.reset();
    setPeriodOpen(false);
    setMessage("Período letivo criado.");
    await load();
  }

  async function changePeriodStatus(item: Period, status: Period["status"]) {
    const response = await fetch("/api/academic-periods/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível alterar o período.");
      return;
    }

    await load();
  }

  async function deletePeriod(item: Period) {
    if (!window.confirm("Excluir o período " + item.name + "?")) return;

    const response = await fetch("/api/academic-periods/" + item.id, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível excluir o período.");
      return;
    }

    await load();
  }

  const statusLabel = {
    PLANNED: "Planejado",
    ACTIVE: "Ativo",
    CLOSED: "Encerrado",
  } as const;

  return (
    <div className="academic-stack">
      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">DISCIPLINAS</span>
            <h2>Catálogo acadêmico</h2>
          </div>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => setSubjectOpen((value) => !value)}
          >
            + Disciplina
          </button>
        </div>

        {subjectOpen ? (
          <form className="compact-form" onSubmit={createSubject}>
            <label>
              Nome
              <input name="name" required placeholder="Ex.: Matemática" />
            </label>
            <label>
              Código
              <input name="code" placeholder="Ex.: MAT" />
            </label>
            <button className="button button--primary">Salvar</button>
          </form>
        ) : null}

        {loading ? (
          <div className="loading-state">Carregando disciplinas...</div>
        ) : (
          <div className="academic-card-grid">
            {subjects.map((item) => (
              <article className="academic-mini-card" key={item.id}>
                <div>
                  <span className={item.active ? "status-dot status-dot--on" : "status-dot"} />
                  <strong>{item.name}</strong>
                </div>
                <small>{item.code || "Sem código"}</small>
                <p>
                  {(item._count?.curriculumSubjects || 0)} grade(s) •{" "}
                  {(item._count?.classSubjects || 0)} turma(s)
                </p>
                <div className="mini-actions">
                  <button className="inline-action" type="button" onClick={() => void toggleSubject(item)}>
                    {item.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    className="inline-action inline-action--danger"
                    type="button"
                    onClick={() => void deleteSubject(item)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PERÍODOS LETIVOS</span>
            <h2>Bimestres, trimestres ou semestres</h2>
          </div>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => setPeriodOpen((value) => !value)}
          >
            + Período
          </button>
        </div>

        {periodOpen ? (
          <form className="period-form" onSubmit={createPeriod}>
            <label>
              Ano letivo
              <input name="schoolYear" type="number" min="2000" max="2100" required defaultValue={new Date().getFullYear()} />
            </label>
            <label>
              Ordem
              <input name="order" type="number" min="1" required defaultValue="1" />
            </label>
            <label>
              Nome
              <input name="name" required placeholder="Ex.: 1º Bimestre" />
            </label>
            <label>
              Início
              <input name="startDate" type="date" required />
            </label>
            <label>
              Fim
              <input name="endDate" type="date" required />
            </label>
            <label>
              Peso
              <input name="weight" type="number" min="0.1" step="0.1" required defaultValue="1" />
            </label>
            <label>
              Status
              <select name="status" defaultValue="PLANNED">
                <option value="PLANNED">Planejado</option>
                <option value="ACTIVE">Ativo</option>
                <option value="CLOSED">Encerrado</option>
              </select>
            </label>
            <button className="button button--primary">Salvar período</button>
          </form>
        ) : null}

        <div className="period-list">
          {periods.map((item) => (
            <article className="period-row" key={item.id}>
              <span className="period-order">{item.order}</span>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.schoolYear} • peso {Number(item.weight).toFixed(2)} •{" "}
                  {new Intl.DateTimeFormat("pt-BR").format(new Date(item.startDate))} a{" "}
                  {new Intl.DateTimeFormat("pt-BR").format(new Date(item.endDate))}
                </small>
              </div>
              <select
                className="table-select"
                value={item.status}
                onChange={(event) =>
                  void changePeriodStatus(item, event.target.value as Period["status"])
                }
              >
                <option value="PLANNED">Planejado</option>
                <option value="ACTIVE">Ativo</option>
                <option value="CLOSED">Encerrado</option>
              </select>
              <span className="muted-small">{statusLabel[item.status]}</span>
              <button
                className="inline-action inline-action--danger"
                type="button"
                onClick={() => void deletePeriod(item)}
              >
                Excluir
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
