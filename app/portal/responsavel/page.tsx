import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export default async function GuardianPortalPage() {
  const session = await requireRole(["GUARDIAN"]);

  const guardian = await prisma.guardian.findFirst({
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
                include: { class: true },
              },
            },
          },
        },
      },
    },
  });

  if (!guardian) {
    return (
      <div className="portal-container">
        <div className="form-alert form-alert--error">
          Seu cadastro de responsável não está disponível.
        </div>
      </div>
    );
  }

  return (
    <div className="portal-container">
      <section className="student-hero">
        <div>
          <span className="eyebrow">PORTAL DO RESPONSÁVEL</span>
          <h1>Olá, {guardian.name.split(" ")[0]} 👋</h1>
          <p>Acompanhe os alunos vinculados ao seu cadastro.</p>
        </div>
      </section>

      <section className="guardian-student-grid">
        {guardian.students.map((link) => {
          const enrollment = link.student.enrollments[0];

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
                {link.financialResponsible ? <span>Responsável financeiro</span> : null}
                {link.authorizedPickup ? <span>Autorizado para retirada</span> : null}
              </div>
            </article>
          );
        })}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div>
            <span className="eyebrow">PRÓXIMAS ETAPAS</span>
            <h2>Visão do responsável</h2>
          </div>
        </div>
        <p className="portal-description">
          A estrutura já está isolada pelo responsável vinculado. Nas próximas fases,
          notas, frequência detalhada, boletos, comunicados e documentos de cada aluno
          serão liberados aqui sem acesso ao backoffice da escola.
        </p>
      </section>
    </div>
  );
}
