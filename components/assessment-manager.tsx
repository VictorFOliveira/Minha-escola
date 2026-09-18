"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ClassItem = {
  id: string;
  name: string;
  gradeLevel: string;
  schoolYear: number;
};

type ClassSubject = {
  id: string;
  subject: { id: string; name: string };
  teacher: { id: string; name: string } | null;
  weeklyClasses: number | null;
};

type Period = {
  id: string;
  schoolYear: number;
  name: string;
  order: number;
  status: string;
};

type Assessment = {
  id: string;
  title: string;
  type: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  assessmentDate: string;
  maxScore: string | number;
  weight: string | number;
  period: Period;
  _count?: { scores: number };
};

type ScoreRow = {
  enrollmentId: string;
  student: { id: string; name: string; registration: string };
  score: {
    id: string;
    score: string | number | null;
    absent: boolean;
    excused: boolean;
    feedback: string | null;
  } | null;
};

type GradeDraft = {
  enrollmentId: string;
  score: string;
  absent: boolean;
  excused: boolean;
  feedback: string;
};

const typeLabels: Record<string, string> = {
  EXAM: "Prova",
  QUIZ: "Quiz",
  ASSIGNMENT: "Trabalho",
  PROJECT: "Projeto",
  PARTICIPATION: "Participação",
  OTHER: "Outra",
};

export function AssessmentManager() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [grading, setGrading] = useState<Assessment | null>(null);
  const [gradeRows, setGradeRows] = useState<GradeDraft[]>([]);
  const [students, setStudents] = useState<Record<string, ScoreRow["student"]>>({});
  const [feedbackEnrollmentId, setFeedbackEnrollmentId] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    void (async () => {
      setSelectedSubjectId("");
      setAssessments([]);
      setSubjects([]);

      if (!selectedClassId) return;

      const response = await fetch(
        "/api/classes/" + selectedClassId + "/subjects",
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível carregar as disciplinas da turma.");
        return;
      }

      setSubjects(data.class.classSubjects || []);
    })();
  }, [selectedClassId]);

  useEffect(() => {
    void (async () => {
      setAssessments([]);
      if (!selectedSubjectId) return;

      const response = await fetch(
        "/api/assessments?classSubjectId=" +
          encodeURIComponent(selectedSubjectId),
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível carregar as avaliações.");
        return;
      }

      setAssessments(data.assessments || []);
    })();
  }, [selectedSubjectId]);

  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const selectedSubject = subjects.find((item) => item.id === selectedSubjectId);
  const compatiblePeriods = useMemo(
    () =>
      periods.filter(
        (item) => !selectedClass || item.schoolYear === selectedClass.schoolYear,
      ),
    [periods, selectedClass],
  );

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSubjectId) return;

    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSubjectId: selectedSubjectId,
          periodId: String(form.get("periodId") || ""),
          title: String(form.get("title") || ""),
          description: String(form.get("description") || ""),
          type: String(form.get("type") || "EXAM"),
          status: String(form.get("status") || "DRAFT"),
          assessmentDate: String(form.get("assessmentDate") || ""),
          dueDate: String(form.get("dueDate") || ""),
          maxScore: String(form.get("maxScore") || "10"),
          weight: String(form.get("weight") || "1"),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível criar a avaliação.");
        return;
      }

      event.currentTarget.reset();
      setFormOpen(false);
      setMessage("Avaliação criada.");
      setSelectedSubjectId((value) => value);
      const listResponse = await fetch(
        "/api/assessments?classSubjectId=" +
          encodeURIComponent(selectedSubjectId),
        { cache: "no-store" },
      );
      const listData = await listResponse.json();
      if (listResponse.ok) setAssessments(listData.assessments || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAssessmentStatus(
    item: Assessment,
    status: Assessment["status"],
  ) {
    const response = await fetch("/api/assessments/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível alterar a avaliação.");
      return;
    }

    setAssessments((current) =>
      current.map((assessment) =>
        assessment.id === item.id ? { ...assessment, status } : assessment,
      ),
    );
  }

  async function openGrades(item: Assessment) {
    setError("");
    setMessage("");

    const response = await fetch(
      "/api/assessments/" + item.id + "/scores",
      { cache: "no-store" },
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível carregar os alunos.");
      return;
    }

    const studentMap: Record<string, ScoreRow["student"]> = {};
    const rows: GradeDraft[] = (data.students || []).map((row: ScoreRow) => {
      studentMap[row.enrollmentId] = row.student;
      return {
        enrollmentId: row.enrollmentId,
        score: row.score?.score == null ? "" : String(row.score.score),
        absent: Boolean(row.score?.absent),
        excused: Boolean(row.score?.excused),
        feedback: row.score?.feedback || "",
      };
    });

    setStudents(studentMap);
    setGradeRows(rows);
    setGrading(item);
    setFeedbackEnrollmentId(rows[0]?.enrollmentId || "");
  }

  function updateGradeRow(
    enrollmentId: string,
    changes: Partial<GradeDraft>,
  ) {
    setGradeRows((current) =>
      current.map((row) =>
        row.enrollmentId === enrollmentId ? { ...row, ...changes } : row,
      ),
    );
  }

  async function saveGrades() {
    if (!grading) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/assessments/" + grading.id + "/scores",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scores: gradeRows }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar as notas.");
        return;
      }

      setMessage("Notas salvas.");
      await openGrades(grading);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function createFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackEnrollmentId) return;

    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/academic-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: feedbackEnrollmentId,
          title: String(form.get("title") || ""),
          content: String(form.get("content") || ""),
          category: String(form.get("category") || "FORMATIVE"),
          visibility: String(form.get("visibility") || "BOTH"),
          publish: true,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível registrar o acompanhamento.");
        return;
      }

      event.currentTarget.reset();
      setFeedbackOpen(false);
      setMessage("Registro formativo publicado.");
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="assessment-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">AVALIAÇÕES E DESEMPENHO</span>
          <h2>Diário de avaliações</h2>
          <p>
            Crie provas e trabalhos, lance notas e publique acompanhamento
            formativo para o aluno.
          </p>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      <section className="panel assessment-context">
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
              <h2>Avaliações da disciplina</h2>
            </div>
            <button
              className="button button--primary button--small"
              type="button"
              onClick={() => setFormOpen((value) => !value)}
            >
              + Nova avaliação
            </button>
          </div>

          {formOpen ? (
            <form className="assessment-form" onSubmit={createAssessment}>
              <label>
                Período
                <select name="periodId" required defaultValue="">
                  <option value="" disabled>Selecione...</option>
                  {compatiblePeriods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Título
                <input name="title" required placeholder="Ex.: Prova 1" />
              </label>
              <label>
                Tipo
                <select name="type" defaultValue="EXAM">
                  <option value="EXAM">Prova</option>
                  <option value="QUIZ">Quiz</option>
                  <option value="ASSIGNMENT">Trabalho</option>
                  <option value="PROJECT">Projeto</option>
                  <option value="PARTICIPATION">Participação</option>
                  <option value="OTHER">Outra</option>
                </select>
              </label>
              <label>
                Data
                <input name="assessmentDate" type="date" required />
              </label>
              <label>
                Entrega
                <input name="dueDate" type="date" />
              </label>
              <label>
                Nota máxima
                <input name="maxScore" type="number" min="0.1" step="0.1" defaultValue="10" required />
              </label>
              <label>
                Peso
                <input name="weight" type="number" min="0.1" step="0.1" defaultValue="1" required />
              </label>
              <label>
                Publicação
                <select name="status" defaultValue="DRAFT">
                  <option value="DRAFT">Rascunho</option>
                  <option value="PUBLISHED">Publicada</option>
                </select>
              </label>
              <label className="assessment-field--wide">
                Descrição
                <input name="description" placeholder="Conteúdo, orientações, observações..." />
              </label>
              <button className="button button--primary" disabled={saving}>
                {saving ? "Salvando..." : "Criar avaliação"}
              </button>
            </form>
          ) : null}

          <div className="assessment-list">
            {assessments.map((item) => (
              <article className="assessment-row" key={item.id}>
                <div>
                  <span className="type-chip">{typeLabels[item.type] || item.type}</span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.period.name} •{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(new Date(item.assessmentDate))}
                  </small>
                </div>
                <span>
                  Máx. {String(item.maxScore)} • peso {String(item.weight)}
                </span>
                <select
                  className="table-select"
                  value={item.status}
                  onChange={(event) =>
                    void updateAssessmentStatus(
                      item,
                      event.target.value as Assessment["status"],
                    )
                  }
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="PUBLISHED">Publicada</option>
                  <option value="CLOSED">Fechada</option>
                </select>
                <button
                  className="button button--secondary button--small"
                  type="button"
                  onClick={() => void openGrades(item)}
                >
                  Lançar notas
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {grading ? (
        <section className="panel grading-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">LANÇAMENTO DE NOTAS</span>
              <h2>{grading.title}</h2>
              <p className="panel-subtitle">
                Nota máxima {String(grading.maxScore)} • {grading.period.name}
              </p>
            </div>
            <button
              className="more-button"
              type="button"
              onClick={() => setGrading(null)}
            >
              ✕
            </button>
          </div>

          <div className="grading-list">
            {gradeRows.map((row) => (
              <article className="grading-row" key={row.enrollmentId}>
                <div className="student-cell">
                  <span className="avatar avatar--small">
                    {students[row.enrollmentId]?.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="enrollment-student">
                    <strong>{students[row.enrollmentId]?.name}</strong>
                    <small>{students[row.enrollmentId]?.registration}</small>
                  </span>
                </div>
                <label>
                  Nota
                  <input
                    type="number"
                    min="0"
                    max={Number(grading.maxScore)}
                    step="0.01"
                    value={row.score}
                    disabled={row.absent}
                    onChange={(event) =>
                      updateGradeRow(row.enrollmentId, {
                        score: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={row.absent}
                    onChange={(event) =>
                      updateGradeRow(row.enrollmentId, {
                        absent: event.target.checked,
                        score: event.target.checked ? "" : row.score,
                      })
                    }
                  />
                  Faltou
                </label>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={row.excused}
                    onChange={(event) =>
                      updateGradeRow(row.enrollmentId, {
                        excused: event.target.checked,
                      })
                    }
                  />
                  Justificada
                </label>
                <input
                  className="grade-feedback-input"
                  value={row.feedback}
                  onChange={(event) =>
                    updateGradeRow(row.enrollmentId, {
                      feedback: event.target.value,
                    })
                  }
                  placeholder="Feedback desta avaliação"
                />
              </article>
            ))}
          </div>

          <div className="grading-actions">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setFeedbackOpen((value) => !value)}
            >
              + Acompanhamento formativo
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={saving}
              onClick={() => void saveGrades()}
            >
              {saving ? "Salvando..." : "Salvar notas"}
            </button>
          </div>

          {feedbackOpen ? (
            <form className="feedback-form" onSubmit={createFeedback}>
              <label>
                Aluno
                <select
                  value={feedbackEnrollmentId}
                  onChange={(event) => setFeedbackEnrollmentId(event.target.value)}
                  required
                >
                  {gradeRows.map((row) => (
                    <option key={row.enrollmentId} value={row.enrollmentId}>
                      {students[row.enrollmentId]?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Categoria
                <select name="category" defaultValue="FORMATIVE">
                  <option value="FORMATIVE">Formativo</option>
                  <option value="ACADEMIC">Acadêmico</option>
                  <option value="BEHAVIOR">Comportamento</option>
                  <option value="SUPPORT">Apoio</option>
                  <option value="GENERAL">Geral</option>
                </select>
              </label>
              <label>
                Visibilidade
                <select name="visibility" defaultValue="BOTH">
                  <option value="BOTH">Aluno e responsável</option>
                  <option value="STUDENT">Somente aluno</option>
                  <option value="GUARDIAN">Somente responsável</option>
                  <option value="INTERNAL">Somente equipe escolar</option>
                </select>
              </label>
              <label>
                Título
                <input name="title" required placeholder="Ex.: Evolução no bimestre" />
              </label>
              <label className="feedback-field--wide">
                Registro
                <textarea
                  name="content"
                  required
                  rows={4}
                  placeholder="Descreva evolução, pontos fortes, dificuldades e orientações."
                />
              </label>
              <button className="button button--primary" disabled={saving}>
                Publicar acompanhamento
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
