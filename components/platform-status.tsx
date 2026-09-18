"use client";

import { useEffect, useState } from "react";

type StatusData = {
  overall: "OK" | "DEGRADED" | "DOWN";
  checkedAt: string;
  database: boolean;
  queues: {
    communicationPending: number;
    communicationFailed: number;
    webhookPending: number;
    webhookFailed: number;
    scanPending: number;
    scanFailed: number;
  };
  billing: { overduePlatformInvoices: number };
  security: { criticalLast24Hours: number };
  integrations: Record<string, boolean>;
  jobs: Array<{
    jobName: string;
    run: {
      status: string;
      startedAt: string;
      finishedAt: string | null;
      error: string | null;
    } | null;
  }>;
};

export function PlatformStatus() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/platform/status", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível consultar o status.");
        return;
      }

      setStatus(data.status);
      setError("");
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, []);

  if (!status) {
    return (
      <div className="loading-state">
        {error || "Consultando serviços..."}
      </div>
    );
  }

  return (
    <div className="platform-status">
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO</span>
          <h2>Status da plataforma</h2>
          <p>
            Atualização automática a cada 30 segundos. Última consulta{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "medium",
            }).format(new Date(status.checkedAt))}
            .
          </p>
        </div>
        <span
          className={
            status.overall === "OK"
              ? "status-chip status-chip--success"
              : status.overall === "DOWN"
                ? "status-chip report-status--failed"
                : "status-chip status-chip--warning"
          }
        >
          {status.overall}
        </span>
      </div>

      <section className="platform-status-grid">
        <article>
          <span>PostgreSQL</span>
          <strong>{status.database ? "OK" : "FALHA"}</strong>
        </article>
        <article>
          <span>Comunicações pendentes</span>
          <strong>{status.queues.communicationPending}</strong>
          <small>{status.queues.communicationFailed} falha(s) final(is)</small>
        </article>
        <article>
          <span>Webhooks pendentes</span>
          <strong>{status.queues.webhookPending}</strong>
          <small>{status.queues.webhookFailed} falha(s) final(is)</small>
        </article>
        <article>
          <span>Arquivos em análise</span>
          <strong>{status.queues.scanPending}</strong>
          <small>{status.queues.scanFailed} scan(s) com falha</small>
        </article>
        <article>
          <span>Faturas SaaS vencidas</span>
          <strong>{status.billing.overduePlatformInvoices}</strong>
        </article>
        <article>
          <span>Eventos críticos 24h</span>
          <strong>{status.security.criticalLast24Hours}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">INTEGRAÇÕES</span>
            <h2>Configuração externa</h2>
          </div>
        </div>
        <div className="platform-integration-status">
          {Object.entries(status.integrations).map(([name, ready]) => (
            <article key={name}>
              <strong>{name}</strong>
              <span
                className={
                  ready
                    ? "status-chip status-chip--success"
                    : "status-chip"
                }
              >
                {ready ? "Configurado" : "Opcional / ausente"}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">JOBS</span>
            <h2>Últimas execuções</h2>
          </div>
        </div>
        <div className="platform-job-list">
          {status.jobs.map(({ jobName, run }) => (
            <article key={jobName}>
              <strong>{jobName}</strong>
              <span>{run?.status || "Nunca executado"}</span>
              <small>
                {run
                  ? new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(run.startedAt))
                  : "—"}
              </small>
              {run?.error ? <p>{run.error}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
