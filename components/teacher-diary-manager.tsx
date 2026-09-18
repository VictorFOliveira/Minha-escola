"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ClassItem = {
  id: string;
  name: string;
  gradeLevel: string;
  schoolYear: number;
  shift: string;
};

type ClassSubject = {
  id: string;
  subject: { id: string; name: string; code: string | null };
  teacher: { id: string; name: string } | null;
};

type Period = {
  id: string;
  schoolYear: number;
  name: string;
  order: number;
};

type Lesson = {
  id: string;
  lessonDate: string;
  startTime: string | null;
  endTime: string | null;
  plannedContent: string | null;
  taughtContent: string | null;
  homework: string | null;
  notes: string | null;
  status: "PLANNED" | "OPEN" | "COMPLETED" | "CANCELLED";
  period: Period | null;
  createdBy: { id: string; name: string; role: string };
  _count?: { attendance: number };
};

type AttendanceRow = {
  enrollmentId: string;
  student: {
    id: string;
    name: string;
    registration: string;
  };
  attendance: {
    id: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
    note: string | null;
  } | null;
};

type AttendanceDraft = {
  enrollmentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note: string;
};

const statusLabels: Record<Lesson["status"], string> = {
  PLANNED: "Planejada",
  OPEN: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const attendanceLabels: Record<AttendanceDraft["status"], string> = {
  PRESENT: "Presente",
  ABSENT: "Falta",
  LATE: "Atraso",
  EXCUSED: "Justificada",
};

export function TeacherDiaryManager() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [attendanceLesson, setAttendanceLesson] = useState<Lesson | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceDraft[]>([]);
  const [studentMap, setStudentMap] = useState<Record<string, AttendanceRow["student"]>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadBase() {
    setLoading(true);
    setError("");

    try {
      const [classResponse, periodResponse] = await Promise.all([
        fetch("/api/classes", { cache: "no-store" }),
        fetch("/api/academic-periods", { cache: "no-store" }),
      ]);

      const [classData, periodData] = await Promise.all([
        classResponse.json(),
        periodResponse.json(),
      ]);

      if (!classResponse.ok) {
        setError(classData.error || "Não foi possível carregar as turmas.");
        return;
      }

      setClasses(classData.classes || []);
      if (periodResponse.ok) setPeriods(periodData.periods || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubjects(classId: string) {
    setSubjects([]);
    setSelectedSubjectId("");
    setLessons([]);

    if (!classId) return;

    const response = await fetch("/api/classes/" + classId + "/subjects", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível carregar as disciplinas.");
      return;
    }

    setSubjects(data.class.classSubjects || []);
  }

  async function loadLessons(classSubjectId: string) {
    setLessons([]);
    if (!classSubjectId) return;

    const response = await fetch(
      "/api/lessons?classSubjectId=" + encodeURIComponent(classSubjectId),
      { cache: "no-store" },
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível carregar o diário.");
      return;
    }

    setLessons(data.lessons || []);
  }

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    void loadSubjects(selectedClassId);
  }, [selectedClassId]);

  useEffect(() => {
    void loadLessons(selectedSubjectId);
  }, [selectedSubjectId]);

  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const selectedSubject = subjects.find((item) => item.id === selectedSubjectId);
  const compatiblePeriods = useMemo(
    () =>
      periods.filter(
        (period) =>
          !selectedClass || period.schoolYear === selectedClass.schoolYear,
      ),
    [periods, selectedClass],
  );

  async function createLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSubjectId) return;

    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSubjectId: selectedSubjectId,
          periodId: String(form.get("periodId") || ""),
          lessonDate: String(form.get("lessonDate") || ""),
          startTime: String(form.get("startTime") || ""),
          endTime: String(form.get("endTime") || ""),
          plannedContent: String(form.get("plannedContent") || ""),
          taughtContent: String(form.get("taughtContent") || ""),
          homework: String(form.get("homework") || ""),
          notes: String(form.get("notes") || ""),
          status: String(form.get("status") || "OPEN"),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível criar a aula.");
        return;
      }

      event.currentTarget.reset();
      setCreateOpen(false);
      setMessage("Aula adicionada ao diário.");
      await loadLessons(selectedSubjectId);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/lessons/" + editing.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: String(form.get("periodId") || ""),
          lessonDate: String(form.get("lessonDate") || ""),
          startTime: String(form.get("startTime") || ""),
          endTime: String(form.get("endTime") || ""),
          plannedContent: String(form.get("plannedContent") || ""),
          taughtContent: String(form.get("taughtContent") || ""),
          homework: String(form.get("homework") || ""),
          notes: String(form.get("notes") || ""),
          status: String(form.get("status") || "OPEN"),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível atualizar a aula.");
        return;
      }

      setEditing(null);
      setMessage("Diário atualizado.");
      await loadLessons(selectedSubjectId);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function openAttendance(lesson: Lesson) {
    setError("");
    setMessage("");

    const response = await fetch(
      "/api/lessons/" + lesson.id + "/attendance",
      { cache: "no-store" },
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível abrir a chamada.");
      return;
    }

    const map: Record<string, AttendanceRow["student"]> = {};
    const rows: AttendanceDraft[] = (data.students || []).map(
      (row: AttendanceRow) => {
        map[row.enrollmentId] = row.student;
        return {
          enrollmentId: row.enrollmentId,
          status: row.attendance?.status || "PRESENT",
          note: row.attendance?.note || "",
        };
      },
    );

    setStudentMap(map);
    setAttendanceRows(rows);
    setAttendanceLesson(lesson);
  }

  function updateAttendance(
    enrollmentId: string,
    changes: Partial<AttendanceDraft>,
  ) {
    setAttendanceRows((current) =>
      current.map((row) =>
        row.enrollmentId === enrollmentId ? { ...row, ...changes } : row,
      ),
    );
  }

  function markAll(status: AttendanceDraft["status"]) {
    setAttendanceRows((current) =>
      current.map((row) => ({ ...row, status })),
    );
  }

  async function saveAttendance(completeLesson: boolean) {
    if (!attendanceLesson) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/lessons/" + attendanceLesson.id + "/attendance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attendance: attendanceRows,
            completeLesson,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar a chamada.");
        return;
      }

      setAttendanceLesson(null);
      setMessage(
        completeLesson
          ? "Chamada salva e aula concluída."
          : "Chamada salva.",
      );
      await loadLessons(selectedSubjectId);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelLesson(lesson: Lesson) {
    if (!window.confirm("Cancelar esta aula no diário?")) return;

    const response = await fetch("/api/lessons/" + lesson.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível cancelar a aula.");
      return;
    }

    await loadLessons(selectedSubjectId);
  }

  const attendanceSummary = useMemo(() => {
    return attendanceRows.reduce(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 },
    );
  }, [attendanceRows]);

  return (
    <div className="teacher-diary-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FASE 6 • DIÁRIO DO PROFESSOR</span>
          <h2>Diário & frequência</h2>
          <p>
            Registre cada aula por disciplina, conteúdo ministrado, tarefa e
            chamada dos alunos.
          </p>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      <section className="panel diary-context">
        <div className="academic-class-selector">
          <label>
            Turma
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              <option value="">Selecione a turma...</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.schoolYear} • {item.name} • {item.gradeLevel}
                </option>
              ))}
            </select>
          </label>

          <label>
            Disciplina
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              disabled={!selectedClassId}
            >
              <option value="">Selecione a disciplina...</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.subject.name}
                  {item.teacher ? " • " + item.teacher.name : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {selectedSubject ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                {selectedClass?.name} • {selectedSubject.subject.name}
              </span>
              <h2>Aulas do diário</h2>
            </div>
            <button
              className="button button--primary button--small"
              type="button"
              onClick={() => setCreateOpen((value) => !value)}
            >
              + Nova aula
            </button>
          </div>

          {createOpen ? (
            <form className="lesson-form" onSubmit={createLesson}>
              <label>
                Período
                <select name="periodId" defaultValue="">
                  <option value="">Sem período definido</option>
                  {compatiblePeriods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data
                <input
                  name="lessonDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label>
                Início
                <input name="startTime" type="time" />
              </label>
              <label>
                Fim
                <input name="endTime" type="time" />
              </label>
              <label>
                Status
                <select name="status" defaultValue="OPEN">
                  <option value="PLANNED">Planejada</option>
                  <option value="OPEN">Em andamento</option>
                </select>
              </label>
              <label className="lesson-field--wide">
                Conteúdo previsto
                <textarea
                  name="plannedContent"
                  rows={3}
                  placeholder="O que estava planejado para a aula?"
                />
              </label>
              <label className="lesson-field--wide">
                Conteúdo ministrado
                <textarea
                  name="taughtContent"
                  rows={3}
                  placeholder="O que foi efetivamente trabalhado?"
                />
              </label>
              <label className="lesson-field--wide">
                Tarefa / atividade
                <textarea
                  name="homework"
                  rows={2}
                  placeholder="Atividade, exercício ou tarefa para casa"
                />
              </label>
              <label className="lesson-field--wide">
                Observações do diário
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Ocorrências ou observações gerais da aula"
                />
              </label>
              <button className="button button--primary" disabled={saving}>
                {saving ? "Salvando..." : "Adicionar ao diário"}
              </button>
            </form>
          ) : null}

          {loading ? (
            <div className="loading-state">Carregando diário...</div>
          ) : lessons.length === 0 ? (
            <div className="empty-records">
              <span>＋</span>
              <h3>Nenhuma aula registrada</h3>
              <p>Adicione a primeira aula desta disciplina.</p>
            </div>
          ) : (
            <div className="lesson-list">
              {lessons.map((lesson) => (
                <article className="lesson-card" key={lesson.id}>
                  <div className="lesson-date-box">
                    <strong>
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                      }).format(new Date(lesson.lessonDate))}
                    </strong>
                    <span>
                      {new Intl.DateTimeFormat("pt-BR", {
                        month: "short",
                      })
                        .format(new Date(lesson.lessonDate))
                        .replace(".", "")}
                    </span>
                  </div>

                  <div className="lesson-main">
                    <div className="lesson-title-row">
                      <strong>
                        {lesson.startTime || "—"}{" "}
                        {lesson.endTime ? "– " + lesson.endTime : ""}
                      </strong>
                      <span
                        className={
                          lesson.status === "COMPLETED"
                            ? "status-chip status-chip--success"
                            : lesson.status === "CANCELLED"
                              ? "status-chip status-chip--warning"
                              : "status-chip"
                        }
                      >
                        {statusLabels[lesson.status]}
                      </span>
                    </div>
                    <p>
                      {lesson.taughtContent ||
                        lesson.plannedContent ||
                        "Conteúdo ainda não informado."}
                    </p>
                    <small>
                      {lesson.period?.name || "Sem período"} • registrado por{" "}
                      {lesson.createdBy.name}
                    </small>
                    {lesson.homework ? (
                      <div className="lesson-homework">
                        <b>Tarefa:</b> {lesson.homework}
                      </div>
                    ) : null}
                  </div>

                  <div className="lesson-actions">
                    {lesson.status !== "CANCELLED" ? (
                      <button
                        className="button button--secondary button--small"
                        type="button"
                        onClick={() => void openAttendance(lesson)}
                      >
                        Chamada
                      </button>
                    ) : null}
                    <button
                      className="inline-action"
                      type="button"
                      onClick={() => setEditing(lesson)}
                    >
                      Editar diário
                    </button>
                    {lesson.status !== "COMPLETED" &&
                    lesson.status !== "CANCELLED" ? (
                      <button
                        className="inline-action inline-action--danger"
                        type="button"
                        onClick={() => void cancelLesson(lesson)}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {editing ? (
        <section className="panel lesson-edit-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">EDITAR DIÁRIO</span>
              <h2>
                {selectedSubject?.subject.name} •{" "}
                {new Intl.DateTimeFormat("pt-BR").format(
                  new Date(editing.lessonDate),
                )}
              </h2>
            </div>
            <button
              className="more-button"
              type="button"
              onClick={() => setEditing(null)}
            >
              ✕
            </button>
          </div>

          <form
            className="lesson-form"
            onSubmit={saveLesson}
            key={editing.id}
          >
            <label>
              Período
              <select name="periodId" defaultValue={editing.period?.id || ""}>
                <option value="">Sem período definido</option>
                {compatiblePeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data
              <input
                name="lessonDate"
                type="date"
                required
                defaultValue={editing.lessonDate.slice(0, 10)}
              />
            </label>
            <label>
              Início
              <input
                name="startTime"
                type="time"
                defaultValue={editing.startTime || ""}
              />
            </label>
            <label>
              Fim
              <input
                name="endTime"
                type="time"
                defaultValue={editing.endTime || ""}
              />
            </label>
            <label>
              Status
              <select name="status" defaultValue={editing.status}>
                <option value="PLANNED">Planejada</option>
                <option value="OPEN">Em andamento</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </label>
            <label className="lesson-field--wide">
              Conteúdo previsto
              <textarea
                name="plannedContent"
                rows={3}
                defaultValue={editing.plannedContent || ""}
              />
            </label>
            <label className="lesson-field--wide">
              Conteúdo ministrado
              <textarea
                name="taughtContent"
                rows={3}
                defaultValue={editing.taughtContent || ""}
              />
            </label>
            <label className="lesson-field--wide">
              Tarefa / atividade
              <textarea
                name="homework"
                rows={2}
                defaultValue={editing.homework || ""}
              />
            </label>
            <label className="lesson-field--wide">
              Observações
              <textarea
                name="notes"
                rows={2}
                defaultValue={editing.notes || ""}
              />
            </label>
            <button className="button button--primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar diário"}
            </button>
          </form>
        </section>
      ) : null}

      {attendanceLesson ? (
        <section className="panel attendance-editor-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CHAMADA</span>
              <h2>
                {selectedSubject?.subject.name} •{" "}
                {new Intl.DateTimeFormat("pt-BR").format(
                  new Date(attendanceLesson.lessonDate),
                )}
              </h2>
            </div>
            <button
              className="more-button"
              type="button"
              onClick={() => setAttendanceLesson(null)}
            >
              ✕
            </button>
          </div>

          <div className="attendance-summary-cards">
            {(
              ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceDraft["status"][]
            ).map((status) => (
              <article key={status}>
                <span>{attendanceLabels[status]}</span>
                <strong>{attendanceSummary[status]}</strong>
              </article>
            ))}
          </div>

          <div className="attendance-bulk-actions">
            <span>Marcar todos:</span>
            <button
              className="inline-action"
              type="button"
              onClick={() => markAll("PRESENT")}
            >
              Presentes
            </button>
            <button
              className="inline-action"
              type="button"
              onClick={() => markAll("ABSENT")}
            >
              Faltas
            </button>
          </div>

          <div className="attendance-roster">
            {attendanceRows.map((row) => (
              <article key={row.enrollmentId}>
                <div className="student-cell">
                  <span className="avatar avatar--small">
                    {studentMap[row.enrollmentId]?.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="enrollment-student">
                    <strong>{studentMap[row.enrollmentId]?.name}</strong>
                    <small>{studentMap[row.enrollmentId]?.registration}</small>
                  </span>
                </div>

                <select
                  value={row.status}
                  onChange={(event) =>
                    updateAttendance(row.enrollmentId, {
                      status: event.target
                        .value as AttendanceDraft["status"],
                    })
                  }
                >
                  <option value="PRESENT">Presente</option>
                  <option value="ABSENT">Falta</option>
                  <option value="LATE">Atraso</option>
                  <option value="EXCUSED">Justificada</option>
                </select>

                <input
                  value={row.note}
                  onChange={(event) =>
                    updateAttendance(row.enrollmentId, {
                      note: event.target.value,
                    })
                  }
                  placeholder="Observação opcional"
                />
              </article>
            ))}
          </div>

          <div className="attendance-save-actions">
            <button
              className="button button--secondary"
              type="button"
              disabled={saving}
              onClick={() => void saveAttendance(false)}
            >
              Salvar chamada
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={saving}
              onClick={() => void saveAttendance(true)}
            >
              {saving ? "Salvando..." : "Salvar e concluir aula"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
