import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ code: string }>;
};

const typeLabels: Record<string, string> = {
  ENROLLMENT_DECLARATION: "Declaração de matrícula",
  ATTENDANCE_DECLARATION: "Declaração de frequência",
  REPORT_CARD: "Boletim escolar",
  SCHOOL_RECORD: "Histórico escolar",
  PAYMENT_RECEIPT: "Recibo de pagamento",
  ENROLLMENT_CONTRACT: "Resumo de matrícula",
  CUSTOM: "Documento escolar",
};

export default async function VerifyDocumentPage({ params }: Props) {
  const { code } = await params;

  const document = await prisma.schoolDocument.findUnique({
    where: { verificationCode: code.toUpperCase() },
    include: {
      school: {
        select: {
          name: true,
          document: true,
          city: true,
          state: true,
        },
      },
      student: {
        select: {
          name: true,
          registration: true,
        },
      },
      issuedBy: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!document) {
    return (
      <main className="verify-document-page">
        <section className="verify-document-card">
          <span className="verify-icon verify-icon--error">×</span>
          <h1>Documento não encontrado</h1>
          <p>
            O código informado não corresponde a um documento emitido pelo
            Minha Escola.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="verify-document-page">
      <section className="verify-document-card">
        <span
          className={
            document.status === "ISSUED"
              ? "verify-icon"
              : "verify-icon verify-icon--error"
          }
        >
          {document.status === "ISSUED" ? "✓" : "×"}
        </span>

        <span className="eyebrow">VERIFICAÇÃO DE DOCUMENTO</span>
        <h1>
          {document.status === "ISSUED"
            ? "Documento válido"
            : "Documento cancelado"}
        </h1>

        <div className="verify-document-details">
          <div>
            <span>Instituição</span>
            <strong>{document.school.name}</strong>
            <small>
              {[document.school.city, document.school.state]
                .filter(Boolean)
                .join(" • ")}
            </small>
          </div>
          <div>
            <span>Documento</span>
            <strong>{typeLabels[document.type] || document.title}</strong>
            <small>{document.title}</small>
          </div>
          {document.student ? (
            <div>
              <span>Aluno</span>
              <strong>{document.student.name}</strong>
              <small>Matrícula {document.student.registration}</small>
            </div>
          ) : null}
          <div>
            <span>Emissão</span>
            <strong>
              {new Intl.DateTimeFormat("pt-BR").format(document.issuedAt)}
            </strong>
            <small>Emitido por {document.issuedBy.name}</small>
          </div>
        </div>

        {document.status === "CANCELLED" ? (
          <div className="form-alert form-alert--error">
            Este documento foi cancelado em{" "}
            {document.cancelledAt
              ? new Intl.DateTimeFormat("pt-BR").format(document.cancelledAt)
              : "data não informada"}
            . {document.cancellationReason}
          </div>
        ) : null}

        <code className="verification-code">{document.verificationCode}</code>
      </section>
    </main>
  );
}
