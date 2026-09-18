import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type SchoolDocumentKind =
  | "ENROLLMENT_DECLARATION"
  | "ATTENDANCE_DECLARATION"
  | "REPORT_CARD"
  | "SCHOOL_RECORD"
  | "PAYMENT_RECEIPT"
  | "ENROLLMENT_CONTRACT"
  | "CUSTOM";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function money(value: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function documentShell(input: {
  schoolName: string;
  schoolDocument?: string | null;
  schoolAddress?: string | null;
  schoolCity?: string | null;
  schoolState?: string | null;
  title: string;
  body: string;
  verificationCode: string;
  issuedAt: Date;
  issuerName: string;
}) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.title)}</title>
<style>
body{font-family:Arial,sans-serif;color:#17233a;margin:0;background:#fff}.doc{max-width:850px;margin:0 auto;padding:48px}.head{text-align:center;border-bottom:2px solid #17233a;padding-bottom:18px}.head h1{font-size:22px;margin:0 0 5px}.head p{margin:3px 0;font-size:11px;color:#5c6879}.title{text-align:center;margin:38px 0 28px;font-size:20px;text-transform:uppercase;letter-spacing:.06em}.body{font-size:14px;line-height:1.8;text-align:justify}.body table{width:100%;border-collapse:collapse;margin:20px 0}.body th,.body td{border:1px solid #d8dee8;padding:8px;font-size:11px;text-align:left}.body th{background:#f3f6fa}.signature{margin-top:70px;text-align:center}.signature span{display:block;border-top:1px solid #17233a;max-width:340px;margin:0 auto;padding-top:7px;font-size:11px}.verify{margin-top:50px;padding-top:14px;border-top:1px solid #d8dee8;font-size:9px;color:#667386}.verify strong{color:#17233a}@media print{.doc{padding:24px}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head>
<body>
<main class="doc">
<header class="head">
<h1>${escapeHtml(input.schoolName)}</h1>
<p>${escapeHtml(input.schoolDocument || "")}</p>
<p>${escapeHtml([input.schoolAddress, input.schoolCity, input.schoolState].filter(Boolean).join(" • "))}</p>
</header>
<h2 class="title">${escapeHtml(input.title)}</h2>
<section class="body">${input.body}</section>
<div class="signature">
<span>${escapeHtml(input.issuerName)}<br/>Emitido eletronicamente em ${escapeHtml(formatDate(input.issuedAt))}</span>
</div>
<div class="verify">
Documento verificável pelo código <strong>${escapeHtml(input.verificationCode)}</strong>.
</div>
</main>
</body>
</html>`;
}

function resultLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    IN_PROGRESS: "Em andamento",
    APPROVED: "Aprovado",
    RECOVERY: "Recuperação",
    FAILED_GRADE: "Reprovado por média",
    FAILED_ATTENDANCE: "Reprovado por frequência",
    FAILED: "Reprovado",
  };
  return labels[status || ""] || status || "—";
}

export async function buildSchoolDocument(input: {
  schoolId: string;
  issuedByUserId: string;
  type: SchoolDocumentKind;
  enrollmentId?: string | null;
  chargeId?: string | null;
  guardianId?: string | null;
  customTitle?: string | null;
  customContent?: string | null;
}) {
  const [school, issuer] = await Promise.all([
    prisma.school.findUnique({ where: { id: input.schoolId } }),
    prisma.user.findFirst({
      where: { id: input.issuedByUserId, schoolId: input.schoolId },
      select: { id: true, name: true, role: true },
    }),
  ]);

  if (!school || !issuer) {
    throw new Error("Escola ou emissor inválido.");
  }

  const issuedAt = new Date();
  const verificationCode = randomBytes(12).toString("hex").toUpperCase();

  let title = "";
  let body = "";
  let snapshot: Record<string, unknown> = {};
  let studentId: string | null = null;
  let enrollmentId: string | null = input.enrollmentId || null;
  let guardianId: string | null = input.guardianId || null;
  let chargeId: string | null = input.chargeId || null;

  if (input.type === "PAYMENT_RECEIPT") {
    if (!input.chargeId) throw new Error("Informe a cobrança.");

    const charge = await prisma.charge.findFirst({
      where: { id: input.chargeId, schoolId: input.schoolId },
      include: {
        student: true,
        guardian: true,
        enrollment: { include: { class: true } },
        payments: { orderBy: { paidAt: "asc" } },
      },
    });

    if (!charge) throw new Error("Cobrança não encontrada.");
    if (Number(charge.paidAmount) <= 0) {
      throw new Error("A cobrança ainda não possui pagamento recebido.");
    }

    studentId = charge.studentId;
    enrollmentId = charge.enrollmentId;
    guardianId = charge.guardianId;
    chargeId = charge.id;
    title = "Recibo de Pagamento";

    snapshot = {
      chargeId: charge.id,
      student: charge.student.name,
      registration: charge.student.registration,
      guardian: charge.guardian?.name || null,
      description: charge.description,
      amount: Number(charge.amount),
      paidAmount: Number(charge.paidAmount),
      paidAt: charge.paidAt,
      payments: charge.payments.map((payment) => ({
        amount: Number(payment.amount),
        method: payment.method,
        paidAt: payment.paidAt,
        provider: payment.provider,
      })),
    };

    body = `
<p>Declaramos, para os devidos fins, o recebimento referente à cobrança abaixo:</p>
<table>
<tr><th>Aluno</th><td>${escapeHtml(charge.student.name)}</td></tr>
<tr><th>Matrícula</th><td>${escapeHtml(charge.student.registration)}</td></tr>
<tr><th>Descrição</th><td>${escapeHtml(charge.description)}</td></tr>
<tr><th>Valor da cobrança</th><td>${escapeHtml(money(charge.amount))}</td></tr>
<tr><th>Valor recebido</th><td>${escapeHtml(money(charge.paidAmount))}</td></tr>
<tr><th>Data de quitação</th><td>${escapeHtml(formatDate(charge.paidAt))}</td></tr>
</table>`;
  } else {
    if (!input.enrollmentId) throw new Error("Informe a matrícula.");

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: input.enrollmentId,
        class: { schoolId: input.schoolId },
      },
      include: {
        student: {
          include: {
            guardians: {
              include: { guardian: true },
              orderBy: { financialResponsible: "desc" },
            },
          },
        },
        class: {
          include: {
            classSubjects: {
              orderBy: { subject: { name: "asc" } },
              include: { subject: true },
            },
          },
        },
        periodGrades: { include: { period: true } },
        subjectResults: {
          include: { classSubject: { include: { subject: true } } },
        },
        academicResult: true,
        lessonAttendances: {
          where: { lesson: { status: "COMPLETED" } },
          select: { status: true },
        },
        billingContract: {
          include: {
            guardian: true,
            billingPlan: true,
            benefits: true,
          },
        },
      },
    });

    if (!enrollment) throw new Error("Matrícula não encontrada.");

    studentId = enrollment.studentId;
    enrollmentId = enrollment.id;
    guardianId =
      input.guardianId ||
      enrollment.student.guardians[0]?.guardianId ||
      null;

    const baseSnapshot = {
      enrollmentId: enrollment.id,
      enrollmentStatus: enrollment.status,
      student: {
        id: enrollment.student.id,
        name: enrollment.student.name,
        registration: enrollment.student.registration,
        document: enrollment.student.document,
        birthDate: enrollment.student.birthDate,
      },
      class: {
        id: enrollment.class.id,
        name: enrollment.class.name,
        gradeLevel: enrollment.class.gradeLevel,
        shift: enrollment.class.shift,
        room: enrollment.class.room,
        schoolYear: enrollment.class.schoolYear,
      },
      guardians: enrollment.student.guardians.map((link) => ({
        id: link.guardian.id,
        name: link.guardian.name,
        relationship: link.relationship,
        financialResponsible: link.financialResponsible,
      })),
    };

    if (input.type === "ENROLLMENT_DECLARATION") {
      title = "Declaração de Matrícula";
      snapshot = baseSnapshot;
      body = `
<p>Declaramos, para os devidos fins, que <strong>${escapeHtml(enrollment.student.name)}</strong>, matrícula <strong>${escapeHtml(enrollment.student.registration)}</strong>, encontra-se ${enrollment.status === "ACTIVE" ? "regularmente matriculado(a)" : "com matrícula pendente"} no ano letivo de <strong>${enrollment.class.schoolYear}</strong>, na turma <strong>${escapeHtml(enrollment.class.name)}</strong>, etapa/série <strong>${escapeHtml(enrollment.class.gradeLevel)}</strong>, turno <strong>${escapeHtml(enrollment.class.shift)}</strong>.</p>`;
    } else if (input.type === "ATTENDANCE_DECLARATION") {
      title = "Declaração de Frequência";
      const attendance = enrollment.lessonAttendances;
      const present = attendance.filter(
        (item) => item.status === "PRESENT" || item.status === "LATE",
      ).length;
      const percent = attendance.length
        ? Math.round((present / attendance.length) * 10000) / 100
        : null;

      snapshot = {
        ...baseSnapshot,
        attendance: {
          totalLessons: attendance.length,
          present,
          percent,
        },
      };

      body = `
<p>Declaramos que <strong>${escapeHtml(enrollment.student.name)}</strong>, matrícula <strong>${escapeHtml(enrollment.student.registration)}</strong>, possui frequência registrada de <strong>${percent === null ? "sem dados suficientes" : escapeHtml(percent.toFixed(2) + "%")}</strong> nas aulas concluídas vinculadas à matrícula da turma <strong>${escapeHtml(enrollment.class.name)}</strong>, ano letivo <strong>${enrollment.class.schoolYear}</strong>.</p>`;
    } else if (input.type === "REPORT_CARD") {
      title = "Boletim Escolar";

      const results = enrollment.class.classSubjects.map((classSubject) => {
        const result = enrollment.subjectResults.find(
          (item) => item.classSubjectId === classSubject.id,
        );
        const grades = enrollment.periodGrades
          .filter((grade) => grade.classSubjectId === classSubject.id)
          .sort((a, b) => a.period.order - b.period.order);

        return {
          subject: classSubject.subject.name,
          periods: grades.map((grade) => ({
            period: grade.period.name,
            average: grade.average === null ? null : Number(grade.average),
          })),
          annualAverage:
            result?.annualAverage === null || result?.annualAverage === undefined
              ? null
              : Number(result.annualAverage),
          recoveryScore:
            result?.recoveryScore === null || result?.recoveryScore === undefined
              ? null
              : Number(result.recoveryScore),
          finalAverage:
            result?.finalAverage === null || result?.finalAverage === undefined
              ? null
              : Number(result.finalAverage),
          attendancePercent:
            result?.attendancePercent === null ||
            result?.attendancePercent === undefined
              ? null
              : Number(result.attendancePercent),
          status: result?.status || "IN_PROGRESS",
        };
      });

      snapshot = {
        ...baseSnapshot,
        results,
        finalResult: enrollment.academicResult?.status || "IN_PROGRESS",
      };

      const periodNames = Array.from(
        new Set(
          enrollment.periodGrades
            .sort((a, b) => a.period.order - b.period.order)
            .map((grade) => grade.period.name),
        ),
      );

      body = `
<p><strong>Aluno:</strong> ${escapeHtml(enrollment.student.name)} &nbsp; <strong>Matrícula:</strong> ${escapeHtml(enrollment.student.registration)}<br/>
<strong>Turma:</strong> ${escapeHtml(enrollment.class.name)} &nbsp; <strong>Ano:</strong> ${enrollment.class.schoolYear}</p>
<table>
<thead><tr><th>Disciplina</th>${periodNames.map((name) => `<th>${escapeHtml(name)}</th>`).join("")}<th>Média final</th><th>Frequência</th><th>Situação</th></tr></thead>
<tbody>
${results
  .map((row) => {
    const byPeriod = new Map(row.periods.map((p) => [p.period, p.average]));
    return `<tr><td>${escapeHtml(row.subject)}</td>${periodNames
      .map((period) => {
        const value = byPeriod.get(period);
        return `<td>${value === null || value === undefined ? "—" : Number(value).toFixed(2)}</td>`;
      })
      .join("")}<td>${row.finalAverage === null ? "—" : row.finalAverage.toFixed(2)}</td><td>${row.attendancePercent === null ? "—" : row.attendancePercent.toFixed(1) + "%"}</td><td>${escapeHtml(resultLabel(row.status))}</td></tr>`;
  })
  .join("")}
</tbody>
</table>
<p><strong>Resultado da matrícula:</strong> ${escapeHtml(resultLabel(enrollment.academicResult?.status))}</p>`;
    } else if (input.type === "SCHOOL_RECORD") {
      title = "Histórico Escolar";

      const history = await prisma.enrollment.findMany({
        where: {
          studentId: enrollment.studentId,
          class: { schoolId: input.schoolId },
        },
        orderBy: { class: { schoolYear: "asc" } },
        include: {
          class: true,
          subjectResults: {
            include: { classSubject: { include: { subject: true } } },
          },
          academicResult: true,
        },
      });

      snapshot = {
        ...baseSnapshot,
        history: history.map((item) => ({
          schoolYear: item.class.schoolYear,
          class: item.class.name,
          gradeLevel: item.class.gradeLevel,
          result: item.academicResult?.status || "IN_PROGRESS",
          subjects: item.subjectResults.map((result) => ({
            subject: result.classSubject.subject.name,
            finalAverage:
              result.finalAverage === null ? null : Number(result.finalAverage),
            status: result.status,
          })),
        })),
      };

      body = `
<p>Histórico acadêmico consolidado de <strong>${escapeHtml(enrollment.student.name)}</strong>, matrícula <strong>${escapeHtml(enrollment.student.registration)}</strong>.</p>
${history
  .map(
    (item) => `<h3>${item.class.schoolYear} — ${escapeHtml(item.class.gradeLevel)} / ${escapeHtml(item.class.name)}</h3>
<table><thead><tr><th>Disciplina</th><th>Média final</th><th>Situação</th></tr></thead><tbody>
${item.subjectResults
  .map(
    (result) =>
      `<tr><td>${escapeHtml(result.classSubject.subject.name)}</td><td>${result.finalAverage === null ? "—" : Number(result.finalAverage).toFixed(2)}</td><td>${escapeHtml(resultLabel(result.status))}</td></tr>`,
  )
  .join("")}
</tbody></table><p><strong>Resultado:</strong> ${escapeHtml(resultLabel(item.academicResult?.status))}</p>`,
  )
  .join("")}`;
    } else if (input.type === "ENROLLMENT_CONTRACT") {
      title = "Contrato / Resumo de Matrícula";
      const financialGuardian =
        enrollment.billingContract?.guardian ||
        enrollment.student.guardians.find((link) => link.financialResponsible)
          ?.guardian ||
        null;

      snapshot = {
        ...baseSnapshot,
        contract: enrollment.billingContract
          ? {
              amount: Number(enrollment.billingContract.installmentAmount),
              installments: enrollment.billingContract.installments,
              dueDay: enrollment.billingContract.dueDay,
              guardian: financialGuardian?.name || null,
              plan: enrollment.billingContract.billingPlan?.name || null,
              benefits: enrollment.billingContract.benefits.map((benefit) => ({
                name: benefit.name,
                type: benefit.type,
                valueType: benefit.valueType,
                value: Number(benefit.value),
              })),
            }
          : null,
      };

      body = `
<p>Resumo da matrícula de <strong>${escapeHtml(enrollment.student.name)}</strong>, matrícula <strong>${escapeHtml(enrollment.student.registration)}</strong>, na turma <strong>${escapeHtml(enrollment.class.name)}</strong>, ano letivo <strong>${enrollment.class.schoolYear}</strong>.</p>
<table>
<tr><th>Responsável</th><td>${escapeHtml(financialGuardian?.name || "Não definido")}</td></tr>
<tr><th>Plano financeiro</th><td>${escapeHtml(enrollment.billingContract?.billingPlan?.name || "Não definido")}</td></tr>
<tr><th>Parcelas</th><td>${escapeHtml(enrollment.billingContract ? enrollment.billingContract.installments + "x de " + money(enrollment.billingContract.installmentAmount) : "Não definido")}</td></tr>
<tr><th>Dia de vencimento</th><td>${escapeHtml(enrollment.billingContract?.dueDay || "—")}</td></tr>
</table>`;
    } else if (input.type === "CUSTOM") {
      title = input.customTitle?.trim() || "Documento Escolar";
      const content = input.customContent?.trim();
      if (!content) throw new Error("Informe o conteúdo do documento.");

      snapshot = {
        ...baseSnapshot,
        customTitle: title,
        customContent: content,
      };

      body = `<p>${escapeHtml(content).replaceAll("\n", "<br/>")}</p>`;
    } else {
      throw new Error("Tipo de documento não suportado.");
    }
  }

  const renderedHtml = documentShell({
    schoolName: school.name,
    schoolDocument: school.document,
    schoolAddress: school.address,
    schoolCity: school.city,
    schoolState: school.state,
    title,
    body,
    verificationCode,
    issuedAt,
    issuerName: issuer.name,
  });

  const jsonSnapshot = JSON.parse(
    JSON.stringify(snapshot),
  ) as Prisma.InputJsonValue;

  return {
    data: {
      schoolId: input.schoolId,
      type: input.type,
      title,
      studentId,
      enrollmentId,
      guardianId,
      chargeId,
      issuedByUserId: input.issuedByUserId,
      verificationCode,
      snapshot: jsonSnapshot,
      renderedHtml,
      issuedAt,
    },
  };
}
