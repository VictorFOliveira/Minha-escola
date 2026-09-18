"use client";

import { FormEvent, useEffect, useState } from "react";

type ImportJob = {
  id: string;
  type: string;
  status: string;
  sourceName: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }> | null;
  createdAt: string;
};

const importTypes = [
  ["STUDENTS", "Alunos"],
  ["GUARDIANS", "Responsáveis"],
  ["TEACHERS", "Professores"],
  ["CLASSES", "Turmas"],
  ["ENROLLMENTS", "Matrículas"],
] as const;

const exportTypes = [
  ["STUDENTS", "Alunos"],
  ["GUARDIANS", "Responsáveis"],
  ["TEACHERS", "Professores"],
  ["CLASSES", "Turmas"],
  ["ENROLLMENTS", "Matrículas"],
  ["FINANCE", "Financeiro"],
  ["ATTENDANCE", "Frequência"],
  ["GRADES", "Notas"],
] as const;

export function DataOperations({
  role,
}: {
  role: string;
}) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/admin/imports", {
        cache: "no-store",
      });
      const data = await response.json();

      if (response.ok) setJobs(data.jobs || []);
    } catch {
      // Import history is secondary to the export area.
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/imports", {
        method: "POST",
        body: form,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível importar.");
        return;
      }

      setMessage(
        "Importação concluída: " +
          data.successRows +
          " sucesso(s), " +
          data.failedRows +
          " falha(s).",
      );
      event.currentTarget.reset();
      await load();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking(false);
    }
  }

  const allowedExportTypes = exportTypes.filter(([type]) => {
    if (role === "ADMIN") return true;
    if (role === "SECRETARY") {
      return ["STUDENTS", "GUARDIANS", "TEACHERS", "CLASSES", "ENROLLMENTS"].includes(type);
    }
    if (role === "COORDINATOR") {
      return ["STUDENTS", "TEACHERS", "CLASSES", "ENROLLMENTS", "ATTENDANCE", "GRADES"].includes(type);
    }
    if (role === "FINANCE") return type === "FINANCE";
    return false;
  });

  return (
    <div className="data-operations">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DADOS</span>
          <h2>Importação & exportação</h2>
          <p>
            Migre dados por CSV/XLSX e gere relatórios operacionais em CSV,
            Excel ou PDF.
          </p>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      {["ADMIN", "SECRETARY"].includes(role) ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">IMPORTAR</span>
              <h2>Migração em massa</h2>
            </div>
          </div>

          <form className="data-import-form" onSubmit={submitImport}>
            <label>
              Tipo
              <select name="type" required defaultValue="STUDENTS">
                {importTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Arquivo
              <input
                name="file"
                type="file"
                accept=".csv,.xlsx"
                required
              />
            </label>
            <button className="button button--primary" disabled={working}>
              {working ? "Importando..." : "Importar"}
            </button>
          </form>

          <div className="data-template-grid">
            {importTypes.map(([value, label]) => (
              <article key={value}>
                <strong>{label}</strong>
                <div>
                  <a
                    className="inline-action"
                    href={
                      "/api/admin/imports/template?type=" +
                      value +
                      "&format=xlsx"
                    }
                  >
                    Template Excel
                  </a>
                  <a
                    className="inline-action"
                    href={
                      "/api/admin/imports/template?type=" +
                      value +
                      "&format=csv"
                    }
                  >
                    Template CSV
                  </a>
                </div>
              </article>
            ))}
          </div>

          {jobs.length ? (
            <div className="data-import-history">
              {jobs.slice(0, 10).map((job) => (
                <article key={job.id}>
                  <div>
                    <strong>{job.type}</strong>
                    <small>{job.sourceName}</small>
                  </div>
                  <span>{job.status}</span>
                  <small>
                    {job.successRows}/{job.totalRows} OK • {job.failedRows} falha(s)
                  </small>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">EXPORTAR</span>
            <h2>Relatórios administrativos</h2>
          </div>
        </div>

        <div className="data-export-grid">
          {allowedExportTypes.map(([value, label]) => (
            <article key={value}>
              <strong>{label}</strong>
              <div>
                {(["xlsx", "csv", "pdf"] as const).map((format) => (
                  <a
                    className="button button--secondary button--small"
                    key={format}
                    href={
                      "/api/admin/exports?type=" +
                      value +
                      "&format=" +
                      format
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {format.toUpperCase()}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
