"use client";

import { useEffect, useState } from "react";

type Log = {
  id: string;
  actorType: "USER" | "PLATFORM_ADMIN" | "SYSTEM";
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  platformAdmin: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export function AuditManager() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/admin/audit", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível carregar a auditoria.");
        return;
      }

      setLogs(data.logs || []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="audit-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FASE 11 • AUDITORIA</span>
          <h2>Auditoria & exportação</h2>
          <p>
            Eventos críticos do tenant e exportação administrativa sem expor
            hashes de senha.
          </p>
        </div>
        <a
          className="button button--primary"
          href="/api/admin/export"
          target="_blank"
          rel="noreferrer"
        >
          Exportar dados
        </a>
      </div>

      {error ? (
        <div className="form-alert form-alert--error">{error}</div>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ÚLTIMOS EVENTOS</span>
            <h2>Trilha de auditoria</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table audit-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Ator</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(log.createdAt))}
                  </td>
                  <td>
                    {log.user?.name ||
                      log.platformAdmin?.name ||
                      "Sistema"}
                  </td>
                  <td>
                    <code>{log.action}</code>
                  </td>
                  <td>{log.entityType}</td>
                  <td>
                    <code>{log.entityId || "—"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!logs.length ? (
          <div className="empty-records">
            <span>◎</span>
            <h3>Nenhum evento auditado ainda</h3>
          </div>
        ) : null}
      </section>
    </div>
  );
}
