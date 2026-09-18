"use client";

import { useEffect, useState } from "react";

type DocumentItem = {
  id: string;
  type: string;
  title: string;
  issuedAt: string;
  verificationCode: string;
  student?: { name: string } | null;
};

const typeLabels: Record<string, string> = {
  ENROLLMENT_DECLARATION: "Declaração de matrícula",
  ATTENDANCE_DECLARATION: "Declaração de frequência",
  REPORT_CARD: "Boletim escolar",
  SCHOOL_RECORD: "Histórico escolar",
  PAYMENT_RECEIPT: "Recibo",
  ENROLLMENT_CONTRACT: "Resumo de matrícula",
  CUSTOM: "Documento escolar",
};

export function PortalDocuments() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/documents/mine", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao carregar documentos.");
        setDocuments(data.documents || []);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Erro ao carregar documentos."),
      );
  }, []);

  return (
    <section className="portal-panel" id="documentos">
      <div className="portal-panel-heading">
        <div>
          <span className="eyebrow">DOCUMENTOS</span>
          <h2>Documentos emitidos</h2>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}

      {documents.length ? (
        <div className="portal-document-grid">
          {documents.map((document) => (
            <article key={document.id}>
              <span>{typeLabels[document.type] || document.type}</span>
              <strong>{document.title}</strong>
              {document.student ? <small>{document.student.name}</small> : null}
              <small>
                Emitido em{" "}
                {new Intl.DateTimeFormat("pt-BR").format(
                  new Date(document.issuedAt),
                )}
              </small>
              <code>{document.verificationCode}</code>
              <div>
                <a
                  className="button button--secondary button--small"
                  href={"/api/documents/" + document.id + "/html"}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir
                </a>
                <a
                  className="inline-action"
                  href={"/api/documents/" + document.id + "/pdf"}
                  target="_blank"
                  rel="noreferrer"
                >
                  PDF
                </a>
                <a
                  className="inline-action"
                  href={"/verificar/" + document.verificationCode}
                  target="_blank"
                  rel="noreferrer"
                >
                  Verificar
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="portal-empty">
          Nenhum documento foi emitido para este acesso.
        </div>
      )}
    </section>
  );
}
