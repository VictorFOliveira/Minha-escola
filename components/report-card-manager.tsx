"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ClassItem = {
  id: string;
  name: string;
  gradeLevel: string;
  schoolYear: number;
};

type SubjectItem = {
  id: string;
  subject: { id: string; name: string; code: string | null };
  teacher: { id: string; name: string } | null;
};

type Period = {
  id: string;
  name: string;
  order: number;
  weight: string | number;
  status: string;
};

type PeriodGrade = {
  id: string;
  classSubjectId: string;
  periodId: string;
  average: string | number | null;
  status: "OPEN" | "CLOSED";
};

type SubjectResult = {
  id: string;
  classSubjectId: string;
  annualAverage: string | number | null;
  recoveryScore: string | number | null;
  finalAverage: string | number | null;
  attendancePercent: string | number | null;
  status:
    | "IN_PROGRESS"
    | "APPROVED"
    | "RECOVERY"
    | "FAILED_GRADE"
    | "FAILED_ATTENDANCE";
};

type EnrollmentItem = {
  id: string;
  status: string;
  student: {
    id: string;
    name: string;
    registration: string;
  };
  periodGrades: PeriodGrade[];
  subjectResults: SubjectResult[];
  academicResult: {
    status: "IN_PROGRESS" | "APPROVED" | "FAILED";
    decisionNote: string | null;
    closedAt: string | null;
  } | null;
};

type ReportData = {
  class: ClassItem & {
    classSubjects: SubjectItem[];
    enrollments: EnrollmentItem[];
  };
  periods: Period[];
  policy: {
    schoolYear: number;
    passingAverage: string | number;
    minimumAttendance: string | number;
    recoveryEnabled: boolean;
    recoveryMode:
      | "REPLACE_IF_HIGHER"
      | "AVERAGE_WITH_ANNUAL"
      | "MANUAL";
  };
  canFinalizeEnrollment: boolean;
  canEditPolicy: boolean;
};

const resultLabels: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  APPROVED: "Aprovado",
  RECOVERY: "Recuperação",
  FAILED_GRADE: "Reprovado por média",
  FAILED_ATTENDANCE: "Reprovado por frequência",
  FAILED: "Reprovado",
};

const recoveryLabels: Record<string, string> = {
  REPLACE_IF_HIGHER: "Usar a maior entre média anual e recuperação",
  AVERAGE_WITH_ANNUAL: "Média entre anual e recuperação",
  MANUAL: "Média final informada manualmente",
};

function numberLabel(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "—";
}

export function ReportCardManager() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [recoveryDrafts, setRecoveryDrafts] = useState<Record<string, string>>({});
  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({});
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadClasses() {
    setLoading(true);
    try {
      const response = await fetch("/api/classes", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Não foi possível carregar as turmas.");
        return;
      }
      setClasses(data.classes || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReport(classId = selectedClassId) {
    if (!classId) {
      setReport(null);
      return;
    }

    setError("");

    const response = await fetch("/api/report-cards/class/" + classId, {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível carregar os boletins.");
      return;
    }

    setReport(data);
    setSelectedSubjectId((current) => {
      const exists = data.class.classSubjects.some(
        (item: SubjectItem) => item.id === current,
      );
      return exists ? current : data.class.classSubjects[0]?.id || "";
    });

    const recovery: Record<string, string> = {};
    const manual: Record<string, string> = {};

    for (const enrollment of data.class.enrollments as EnrollmentItem[]) {
      for (const result of enrollment.subjectResults) {
        recovery[enrollment.id + "::" + result.classSubjectId] =
          result.recoveryScore === null ? "" : String(result.recoveryScore);
        manual[enrollment.id + "::" + result.classSubjectId] =
          result.finalAverage === null ? "" : String(result.finalAverage);
      }
    }

    setRecoveryDrafts(recovery);
    setManualDrafts(manual);
  }

  useEffect(() => {
    void loadClasses();
  }, []);

  useEffect(() => {
    void loadReport(selectedClassId);
  }, [selectedClassId]);

  const selectedSubject = report?.class.classSubjects.find(
    (item) => item.id === selectedSubjectId,
  );

  const allSelectedResults = useMemo(() => {
    if (!report || !selectedSubjectId) return [];

    return report.class.enrollments.map((enrollment) => ({
      enrollment,
      result:
        enrollment.subjectResults.find(
          (item) => item.classSubjectId === selectedSubjectId,
        ) || null,
    }));
  }, [report, selectedSubjectId]);

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report) return;

    setWorking("policy");
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/academic-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolYear: report.class.schoolYear,
          passingAverage: String(form.get("passingAverage") || ""),
          minimumAttendance: String(form.get("minimumAttendance") || ""),
          recoveryEnabled: form.get("recoveryEnabled") === "on",
          recoveryMode: String(form.get("recoveryMode") || ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar a política acadêmica.");
        return;
      }

      setMessage("Política acadêmica atualizada.");
      await loadReport();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function closePeriod(periodId: string) {
    if (!selectedSubjectId) return;

    setWorking("period:" + periodId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/report-cards/close-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSubjectId: selectedSubjectId,
          periodId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        const extra = Array.isArray(data.students)
          ? " Pendentes: " + data.students.slice(0, 5).join(", ") + "."
          : "";
        setError((data.error || "Não foi possível fechar o período.") + extra);
        return;
      }

      setMessage("Média do período fechada para a turma.");
      await loadReport();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function closeSubject() {
    if (!selectedSubjectId) return;

    setWorking("subject");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/report-cards/close-subject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classSubjectId: selectedSubjectId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível fechar a disciplina.");
        return;
      }

      setMessage(
        "Resultado anual calculado. " +
          data.recovery +
          " aluno(s) ficaram em recuperação.",
      );
      await loadReport();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function saveRecovery(enrollmentId: string) {
    if (!selectedSubjectId || !report) return;

    const key = enrollmentId + "::" + selectedSubjectId;
    setWorking("recovery:" + enrollmentId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/report-cards/recovery", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          classSubjectId: selectedSubjectId,
          recoveryScore: recoveryDrafts[key] ?? "",
          manualFinalAverage:
            report.policy.recoveryMode === "MANUAL"
              ? manualDrafts[key] ?? ""
              : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar a recuperação.");
        return;
      }

      setMessage("Recuperação recalculada.");
      await loadReport();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  async function finalizeEnrollment(enrollmentId: string) {
    setWorking("final:" + enrollmentId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/report-cards/finalize-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          decisionNote: decisionNotes[enrollmentId] || "",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível fechar o resultado do aluno.");
        return;
      }

      setMessage("Resultado final da matrícula fechado.");
      await loadReport();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="report-card-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FASE 7 • BOLETINS</span>
          <h2>Fechamento acadêmico</h2>
          <p>
            Médias por período, recuperação, frequência e resultado final da
            matrícula em um único fluxo.
          </p>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      <section className="panel report-context">
        <label className="report-class-select">
          Turma
          <select
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
          >
            <option value="">Selecione uma turma...</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.schoolYear} • {item.name} • {item.gradeLevel}
              </option>
            ))}
          </select>
        </label>
      </section>

      {report?.canEditPolicy ? (
        <section className="panel academic-policy-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">REGRA DO ANO {report.class.schoolYear}</span>
              <h2>Política acadêmica</h2>
            </div>
          </div>

          <form
            className="academic-policy-form"
            onSubmit={savePolicy}
            key={
              report.class.schoolYear +
              ":" +
              String(report.policy.passingAverage) +
              ":" +
              String(report.policy.minimumAttendance) +
              ":" +
              report.policy.recoveryMode
            }
          >
            <label>
              Média mínima
              <input
                name="passingAverage"
                type="number"
                min="0"
                max="10"
                step="0.01"
                defaultValue={String(report.policy.passingAverage)}
              />
            </label>
            <label>
              Frequência mínima (%)
              <input
                name="minimumAttendance"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={String(report.policy.minimumAttendance)}
              />
            </label>
            <label>
              Regra da recuperação
              <select
                name="recoveryMode"
                defaultValue={report.policy.recoveryMode}
              >
                <option value="REPLACE_IF_HIGHER">
                  Maior média
                </option>
                <option value="AVERAGE_WITH_ANNUAL">
                  Média com a anual
                </option>
                <option value="MANUAL">
                  Resultado manual
                </option>
              </select>
            </label>
            <label className="policy-check">
              <input
                name="recoveryEnabled"
                type="checkbox"
                defaultChecked={report.policy.recoveryEnabled}
              />
              Recuperação habilitada
            </label>
            <button className="button button--primary" disabled={working === "policy"}>
              {working === "policy" ? "Salvando..." : "Salvar regra"}
            </button>
          </form>
        </section>
      ) : null}

      {report ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">DISCIPLINA</span>
              <h2>Fechamento por componente curricular</h2>
            </div>
          </div>

          <div className="subject-tab-list">
            {report.class.classSubjects.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  item.id === selectedSubjectId
                    ? "subject-tab subject-tab--active"
                    : "subject-tab"
                }
                onClick={() => setSelectedSubjectId(item.id)}
              >
                <strong>{item.subject.name}</strong>
                <small>{item.teacher?.name || "Professor não definido"}</small>
              </button>
            ))}
          </div>

          {selectedSubject ? (
            <>
              <div className="period-closing-grid">
                {report.periods.map((period) => {
                  const closedCount = report.class.enrollments.filter(
                    (enrollment) =>
                      enrollment.periodGrades.some(
                        (grade) =>
                          grade.classSubjectId === selectedSubjectId &&
                          grade.periodId === period.id &&
                          grade.status === "CLOSED",
                      ),
                  ).length;
                  const allClosed =
                    report.class.enrollments.length > 0 &&
                    closedCount === report.class.enrollments.length;

                  return (
                    <article key={period.id}>
                      <span>{period.order}</span>
                      <div>
                        <strong>{period.name}</strong>
                        <small>
                          Peso {numberLabel(period.weight)} • {closedCount}/
                          {report.class.enrollments.length} fechados
                        </small>
                      </div>
                      <button
                        className={
                          allClosed
                            ? "button button--secondary button--small"
                            : "button button--primary button--small"
                        }
                        type="button"
                        disabled={working === "period:" + period.id}
                        onClick={() => void closePeriod(period.id)}
                      >
                        {working === "period:" + period.id
                          ? "Fechando..."
                          : allClosed
                            ? "Recalcular"
                            : "Fechar período"}
                      </button>
                    </article>
                  );
                })}
              </div>

              <div className="subject-close-bar">
                <div>
                  <strong>{selectedSubject.subject.name}</strong>
                  <span>
                    {recoveryLabels[report.policy.recoveryMode]} • média mínima{" "}
                    {numberLabel(report.policy.passingAverage)}
                  </span>
                </div>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={working === "subject"}
                  onClick={() => void closeSubject()}
                >
                  {working === "subject"
                    ? "Calculando..."
                    : "Calcular resultado anual"}
                </button>
              </div>

              <div className="table-wrap">
                <table className="data-table report-table">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      {report.periods.map((period) => (
                        <th key={period.id}>{period.name}</th>
                      ))}
                      <th>Anual</th>
                      <th>Freq.</th>
                      <th>Recup.</th>
                      <th>Final</th>
                      <th>Situação</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSelectedResults.map(({ enrollment, result }) => {
                      const key =
                        enrollment.id + "::" + selectedSubjectId;

                      return (
                        <tr key={enrollment.id}>
                          <td>
                            <span className="enrollment-student">
                              <strong>{enrollment.student.name}</strong>
                              <small>{enrollment.student.registration}</small>
                            </span>
                          </td>
                          {report.periods.map((period) => {
                            const grade = enrollment.periodGrades.find(
                              (item) =>
                                item.classSubjectId === selectedSubjectId &&
                                item.periodId === period.id,
                            );

                            return (
                              <td key={period.id}>
                                <strong>{numberLabel(grade?.average)}</strong>
                              </td>
                            );
                          })}
                          <td>{numberLabel(result?.annualAverage)}</td>
                          <td>
                            {result?.attendancePercent === null ||
                            result?.attendancePercent === undefined
                              ? "—"
                              : numberLabel(result.attendancePercent) + "%"}
                          </td>
                          <td>
                            {result?.status === "RECOVERY" ||
                            result?.recoveryScore !== null ? (
                              <input
                                className="recovery-input"
                                type="number"
                                min="0"
                                max="10"
                                step="0.01"
                                value={recoveryDrafts[key] ?? ""}
                                onChange={(event) =>
                                  setRecoveryDrafts((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }
                                placeholder="Nota"
                              />
                            ) : (
                              numberLabel(result?.recoveryScore)
                            )}
                            {report.policy.recoveryMode === "MANUAL" &&
                            result?.status === "RECOVERY" ? (
                              <input
                                className="recovery-input"
                                type="number"
                                min="0"
                                max="10"
                                step="0.01"
                                value={manualDrafts[key] ?? ""}
                                onChange={(event) =>
                                  setManualDrafts((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }
                                placeholder="Média final"
                              />
                            ) : null}
                          </td>
                          <td>
                            <strong>{numberLabel(result?.finalAverage)}</strong>
                          </td>
                          <td>
                            <span
                              className={
                                result?.status === "APPROVED"
                                  ? "status-chip status-chip--success"
                                  : result?.status === "RECOVERY"
                                    ? "status-chip status-chip--warning"
                                    : result?.status?.startsWith("FAILED")
                                      ? "status-chip report-status--failed"
                                      : "status-chip"
                              }
                            >
                              {resultLabels[result?.status || "IN_PROGRESS"]}
                            </span>
                          </td>
                          <td>
                            {result?.status === "RECOVERY" ||
                            result?.recoveryScore !== null ? (
                              <button
                                className="inline-action"
                                type="button"
                                disabled={
                                  working === "recovery:" + enrollment.id
                                }
                                onClick={() =>
                                  void saveRecovery(enrollment.id)
                                }
                              >
                                Salvar recup.
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {report?.canFinalizeEnrollment ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">RESULTADO DA MATRÍCULA</span>
              <h2>Fechamento do ano letivo</h2>
            </div>
          </div>

          <div className="final-enrollment-list">
            {report.class.enrollments.map((enrollment) => (
              <article key={enrollment.id}>
                <div>
                  <strong>{enrollment.student.name}</strong>
                  <small>{enrollment.student.registration}</small>
                </div>
                <span
                  className={
                    enrollment.academicResult?.status === "APPROVED"
                      ? "status-chip status-chip--success"
                      : enrollment.academicResult?.status === "FAILED"
                        ? "status-chip report-status--failed"
                        : "status-chip"
                  }
                >
                  {resultLabels[
                    enrollment.academicResult?.status || "IN_PROGRESS"
                  ]}
                </span>
                <input
                  value={decisionNotes[enrollment.id] || ""}
                  onChange={(event) =>
                    setDecisionNotes((current) => ({
                      ...current,
                      [enrollment.id]: event.target.value,
                    }))
                  }
                  placeholder="Observação final opcional"
                />
                <button
                  className="button button--secondary button--small"
                  type="button"
                  disabled={working === "final:" + enrollment.id}
                  onClick={() => void finalizeEnrollment(enrollment.id)}
                >
                  {working === "final:" + enrollment.id
                    ? "Fechando..."
                    : enrollment.academicResult
                      ? "Reabrir cálculo / fechar"
                      : "Fechar resultado"}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
