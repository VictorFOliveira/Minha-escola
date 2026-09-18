import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { CommunicationInbox } from "@/components/communication-inbox";
import { PortalDocuments } from "@/components/portal-documents";

const resultLabels: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  APPROVED: "Aprovado",
  RECOVERY: "Recuperação",
  FAILED_GRADE: "Reprovado por média",
  FAILED_ATTENDANCE: "Reprovado por frequência",
  FAILED: "Reprovado",
};

const chargeLabels: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Em atraso",
  CANCELLED: "Cancelada",
  REFUNDED: "Estornada",
};

function money(value: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export default async function GuardianPortalPage() {
  const session = await requireRole(["GUARDIAN"]);

  const [guardian, financeSettings] = await Promise.all([
    prisma.guardian.findFirst({
      where: {
        id: session.guardianId || "__none__",
        schoolId: session.schoolId,
        status: "ACTIVE",
      },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  where: { status: { in: ["ACTIVE", "PENDING"] } },
                  orderBy: { startedAt: "desc" },
                  take: 1,
                  include: {
                    class: {
                      include: {
                        classSubjects: {
                          orderBy: { subject: { name: "asc" } },
                          include: {
                            subject: true,
                            teacher: true,
                          },
                        },
                      },
                    },
                    periodGrades: true,
                    subjectResults: true,
                    academicResult: true,
                  },
                },
                charges: {
                  where: {
                    guardianId: session.guardianId || "__none__",
                    status: { not: "CANCELLED" },
                  },
                  orderBy: { dueDate: "desc" },
                  include: {
                    payments: {
                      orderBy: { paidAt: "desc" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.financeSettings.findUnique({
      where: { schoolId: session.schoolId },
    }),
  ]);

  if (!guardian) {
    return (
      <div className="portal-container">
        <div className="form-alert form-alert--error">
          Seu cadastro de responsável não está disponível.
        </div>
      </div>
    );
  }

  const showReports = financeSettings?.sendReportToGuardian !== false;
  const showBilling = financeSettings?.sendBillingToGuardian !== false;

  return (
    <div className="portal-container">
      <section className="student-hero">
        <div>
          <span className="eyebrow">PORTAL DO RESPONSÁVEL</span>
          <h1>Olá, {guardian.name.split(" ")[0]} 👋</h1>
          <p>
            Acompanhe vida acadêmica e financeira dos alunos vinculados ao seu
            cadastro.
          </p>
        </div>
      </section>

      <CommunicationInbox title="Comunicados e autorizações" />
      <PortalDocuments />

      <section className="guardian-student-grid">
        {guardian.students.map((link) => {
          const enrollment = link.student.enrollments[0];
          const openCharges = link.student.charges.filter(
            (charge) =>
              !["PAID", "CANCELLED", "REFUNDED"].includes(charge.status),
          );

          return (
            <article className="guardian-student-card" key={link.studentId}>
              <div className="avatar">
                {link.student.name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <span className="eyebrow">{link.relationship}</span>
                <h2>{link.student.name}</h2>
                <p>
                  {enrollment
                    ? enrollment.class.name +
                      " • " +
                      enrollment.class.schoolYear +
                      " • " +
                      enrollment.class.shift
                    : "Sem matrícula ativa"}
                </p>
              </div>
              <div className="guardian-flags">
                {link.financialResponsible ? (
                  <span>Responsável financeiro</span>
                ) : null}
                {link.authorizedPickup ? (
                  <span>Autorizado para retirada</span>
                ) : null}
                {link.financialResponsible && openCharges.length ? (
                  <span>{openCharges.length} cobrança(s) em aberto</span>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {showReports ? (
        <section className="portal-panel">
          <div className="portal-panel-heading">
            <div>
              <span className="eyebrow">BOLETINS</span>
              <h2>Acompanhamento acadêmico</h2>
            </div>
          </div>

          <div className="guardian-report-stack">
            {guardian.students.map((link) => {
              const enrollment = link.student.enrollments[0];
              if (!enrollment) return null;

              return (
                <article className="guardian-report-card" key={link.studentId}>
                  <div className="guardian-report-head">
                    <div>
                      <strong>{link.student.name}</strong>
                      <span>
                        {enrollment.class.name} •{" "}
                        {enrollment.class.schoolYear}
                      </span>
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
                      {
                        resultLabels[
                          enrollment.academicResult?.status || "IN_PROGRESS"
                        ]
                      }
                    </span>
                  </div>

                  <div className="guardian-report-subjects">
                    {enrollment.class.classSubjects.map((classSubject) => {
                      const result = enrollment.subjectResults.find(
                        (item) => item.classSubjectId === classSubject.id,
                      );

                      return (
                        <div key={classSubject.id}>
                          <span>
                            <strong>{classSubject.subject.name}</strong>
                            <small>
                              {classSubject.teacher?.name ||
                                "Professor não definido"}
                            </small>
                          </span>
                          <b>
                            {result?.finalAverage === null ||
                            result?.finalAverage === undefined
                              ? "—"
                              : Number(result.finalAverage).toFixed(2)}
                          </b>
                          <em>
                            {
                              resultLabels[
                                result?.status || "IN_PROGRESS"
                              ]
                            }
                          </em>
                        </div>
                      );
                    })}
                  </div>

                  {enrollment.academicResult?.decisionNote ? (
                    <p className="guardian-report-note">
                      {enrollment.academicResult.decisionNote}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {showBilling ? (
        <section className="portal-panel" id="financeiro">
          <div className="portal-panel-heading">
            <div>
              <span className="eyebrow">FINANCEIRO</span>
              <h2>Mensalidades e pagamentos</h2>
            </div>
          </div>

          {financeSettings?.gatewayEnabled &&
          financeSettings.provider === "EXTERNAL" &&
          financeSettings.externalPaymentUrl ? (
            <div className="guardian-external-payment">
              <div>
                <strong>Sistema de pagamentos da escola</strong>
                <p>
                  Esta escola utiliza uma plataforma própria para emissão e
                  pagamento das cobranças.
                </p>
              </div>
              <a
                className="button button--primary button--small"
                href={financeSettings.externalPaymentUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir pagamentos
              </a>
            </div>
          ) : null}

          <div className="guardian-charge-list">
            {guardian.students.flatMap((link) =>
              link.student.charges
                .filter(
                  (charge) =>
                    link.financialResponsible ||
                    charge.status === "PAID",
                )
                .map((charge) => (
                  <article key={charge.id}>
                    <div>
                      <strong>{link.student.name}</strong>
                      <span>{charge.description}</span>
                      <small>
                        Vencimento{" "}
                        {new Intl.DateTimeFormat("pt-BR").format(
                          charge.dueDate,
                        )}
                      </small>
                    </div>

                    <div className="guardian-charge-value">
                      <strong>{money(charge.amount)}</strong>
                      {Number(charge.paidAmount) > 0 ? (
                        <small>
                          Pago: {money(charge.paidAmount)}
                        </small>
                      ) : null}
                    </div>

                    <span
                      className={
                        charge.status === "PAID"
                          ? "status-chip status-chip--success"
                          : charge.status === "OVERDUE"
                            ? "status-chip finance-status--overdue"
                            : charge.status === "PARTIAL"
                              ? "status-chip status-chip--warning"
                              : "status-chip"
                      }
                    >
                      {chargeLabels[charge.status] || charge.status}
                    </span>

                    <div className="guardian-charge-actions">
                      {charge.invoiceUrl ? (
                        <a
                          className="button button--secondary button--small"
                          href={charge.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir fatura
                        </a>
                      ) : null}
                      {charge.bankSlipUrl ? (
                        <a
                          className="inline-action"
                          href={charge.bankSlipUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Boleto
                        </a>
                      ) : null}
                      {charge.pixCopyPaste ? (
                        <details>
                          <summary>PIX Copia e Cola</summary>
                          <code>{charge.pixCopyPaste}</code>
                        </details>
                      ) : null}
                    </div>
                  </article>
                )),
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
