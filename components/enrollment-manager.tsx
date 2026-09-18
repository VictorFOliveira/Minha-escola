"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Student = {
  id: string;
  name: string;
  registration: string;
};

type ClassItem = {
  id: string;
  name: string;
  gradeLevel: string;
  shift: string;
  room: string | null;
  capacity: number | null;
  schoolYear: number;
  _count: { enrollments: number };
};

type Enrollment = {
  id: string;
  type: "NEW" | "REENROLLMENT" | "TRANSFER";
  status: "ACTIVE" | "PENDING" | "TRANSFERRED" | "CANCELLED";
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  student: Student;
  class: ClassItem;
  previousEnrollment?: { class: ClassItem } | null;
  nextEnrollment?: { class: ClassItem } | null;
};

const statusLabels: Record<Enrollment["status"], string> = {
  ACTIVE: "Ativa",
  PENDING: "Pendente",
  TRANSFERRED: "Transferida",
  CANCELLED: "Cancelada",
};

const typeLabels: Record<Enrollment["type"], string> = {
  NEW: "Matrícula",
  REENROLLMENT: "Rematrícula",
  TRANSFER: "Transferência",
};

export function EnrollmentManager() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [reenrollSource, setReenrollSource] = useState<Enrollment | null>(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      if (yearFilter !== "all") query.set("schoolYear", yearFilter);

      const [enrollmentResponse, studentResponse, classResponse] = await Promise.all([
        fetch("/api/enrollments?" + query.toString(), { cache: "no-store" }),
        fetch("/api/students?all=1", { cache: "no-store" }),
        fetch("/api/classes?all=1", { cache: "no-store" }),
      ]);

      const [enrollmentData, studentData, classData] = await Promise.all([
        enrollmentResponse.json(),
        studentResponse.json(),
        classResponse.json(),
      ]);

      if (!enrollmentResponse.ok) {
        setError(enrollmentData.error || "Não foi possível carregar as matrículas.");
        return;
      }

      setEnrollments(enrollmentData.enrollments || []);
      if (enrollmentData.meta) setMeta(enrollmentData.meta);
      if (studentResponse.ok) setStudents(studentData.students || []);
      if (classResponse.ok) setClasses(classData.classes || []);
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
  }, [page, search, yearFilter]);

  const years = useMemo(
    () => Array.from(new Set(classes.map((item) => item.schoolYear))).sort((a, b) => b - a),
    [classes],
  );

  const visible = useMemo(() => enrollments, [enrollments]);

  async function createEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      studentId: String(form.get("studentId") || ""),
      classId: String(form.get("classId") || ""),
      status: String(form.get("status") || "ACTIVE"),
      startedAt: String(form.get("startedAt") || ""),
      notes: String(form.get("notes") || ""),
    };

    try {
      const response = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível realizar a matrícula.");
        return;
      }

      setCreateOpen(false);
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item: Enrollment, status: Enrollment["status"]) {
    const response = await fetch("/api/enrollments/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível alterar a matrícula.");
      return;
    }

    await load();
  }

  async function reenroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reenrollSource) return;

    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      targetClassId: String(form.get("targetClassId") || ""),
      status: String(form.get("status") || "ACTIVE"),
      startedAt: String(form.get("startedAt") || ""),
      notes: String(form.get("notes") || ""),
    };

    try {
      const response = await fetch("/api/enrollments/" + reenrollSource.id + "/reenroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível realizar a rematrícula.");
        return;
      }

      setReenrollSource(null);
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  const targetClasses = reenrollSource
    ? classes.filter((item) => item.schoolYear > reenrollSource.class.schoolYear)
    : [];

  return (
    <div className="enrollment-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SECRETARIA</span>
          <h2>Matrículas</h2>
          <p>Matrícula, rematrícula e histórico por ano letivo.</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => setCreateOpen(true)}>
          + Nova matrícula
        </button>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}

      {createOpen ? (
        <section className="panel enrollment-form-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">NOVA MATRÍCULA</span>
              <h2>Matricular aluno em uma turma</h2>
            </div>
            <button className="more-button" type="button" onClick={() => setCreateOpen(false)}>✕</button>
          </div>
          <form className="enrollment-form" onSubmit={createEnrollment}>
            <label>
              Aluno
              <select name="studentId" required defaultValue="">
                <option value="" disabled>Selecione o aluno...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} • {student.registration}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Turma
              <select name="classId" required defaultValue="">
                <option value="" disabled>Selecione a turma...</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.schoolYear} • {item.name} • {item.shift}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status inicial
              <select name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">Ativa</option>
                <option value="PENDING">Pendente</option>
              </select>
            </label>
            <label>
              Data da matrícula
              <input name="startedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="enrollment-field--wide">
              Observações
              <input name="notes" placeholder="Opcional" />
            </label>
            <div className="enrollment-form-actions">
              <button className="button button--secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</button>
              <button className="button button--primary" disabled={saving}>
                {saving ? "Matriculando..." : "Confirmar matrícula"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {reenrollSource ? (
        <section className="panel reenrollment-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">REMATRÍCULA</span>
              <h2>{reenrollSource.student.name}</h2>
              <p className="panel-subtitle">
                Origem: {reenrollSource.class.name} • {reenrollSource.class.schoolYear}
              </p>
            </div>
            <button className="more-button" type="button" onClick={() => setReenrollSource(null)}>✕</button>
          </div>
          <form className="enrollment-form" onSubmit={reenroll}>
            <label>
              Nova turma
              <select name="targetClassId" required defaultValue="">
                <option value="" disabled>Selecione a turma do próximo ano...</option>
                {targetClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.schoolYear} • {item.name} • {item.gradeLevel}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">Ativa</option>
                <option value="PENDING">Pendente</option>
              </select>
            </label>
            <label>
              Data
              <input name="startedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="enrollment-field--wide">
              Observações
              <input name="notes" placeholder="Opcional" />
            </label>
            <div className="enrollment-form-actions">
              <button className="button button--secondary" type="button" onClick={() => setReenrollSource(null)}>Cancelar</button>
              <button className="button button--primary" disabled={saving || targetClasses.length === 0}>
                {saving ? "Rematriculando..." : "Confirmar rematrícula"}
              </button>
            </div>
          </form>
          {targetClasses.length === 0 ? (
            <div className="form-alert">Cadastre primeiro uma turma de ano letivo posterior.</div>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="enrollment-toolbar">
          <div className="search-box">
            ⌕
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar aluno, matrícula ou turma..."
            />
          </div>
          <select
            value={yearFilter}
            onChange={(event) => {
              setYearFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos os anos</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <span className="record-count">{meta.total} matrículas</span>
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
          <div className="loading-state">Carregando matrículas...</div>
        ) : visible.length === 0 ? (
          <div className="empty-records">
            <span>＋</span>
            <h3>Nenhuma matrícula encontrada</h3>
            <p>Crie uma turma e matricule o primeiro aluno.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table enrollment-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Turma</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Histórico</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="student-cell">
                        <span className="avatar avatar--small">
                          {item.student.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                        </span>
                        <span className="enrollment-student">
                          <strong>{item.student.name}</strong>
                          <small>{item.student.registration}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{item.class.name}</strong>
                      <small className="table-subline">{item.class.schoolYear} • {item.class.shift}</small>
                    </td>
                    <td><span className="type-chip">{typeLabels[item.type]}</span></td>
                    <td>
                      <select
                        className="table-select"
                        value={item.status}
                        onChange={(event) => void changeStatus(item, event.target.value as Enrollment["status"])}
                      >
                        <option value="ACTIVE">Ativa</option>
                        <option value="PENDING">Pendente</option>
                        <option value="TRANSFERRED">Transferida</option>
                        <option value="CANCELLED">Cancelada</option>
                      </select>
                    </td>
                    <td>{new Intl.DateTimeFormat("pt-BR").format(new Date(item.startedAt))}</td>
                    <td>
                      {item.previousEnrollment
                        ? "← " + item.previousEnrollment.class.name + " " + item.previousEnrollment.class.schoolYear
                        : item.nextEnrollment
                          ? "→ " + item.nextEnrollment.class.name + " " + item.nextEnrollment.class.schoolYear
                          : "—"}
                    </td>
                    <td>
                      {!item.nextEnrollment && item.status !== "CANCELLED" ? (
                        <button className="inline-action" type="button" onClick={() => setReenrollSource(item)}>
                          Rematricular
                        </button>
                      ) : (
                        <span className="muted-small">Histórico fechado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
