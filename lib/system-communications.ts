import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { publishCommunication } from "@/lib/communication";

async function createAndPublishToGuardian(input: {
  session: SessionUser;
  systemKey: string;
  guardianId: string;
  title: string;
  content: string;
  priority?: "NORMAL" | "IMPORTANT" | "URGENT";
  requiresAcknowledgement?: boolean;
}) {
  const existing = await prisma.communication.findUnique({
    where: {
      schoolId_systemKey: {
        schoolId: input.session.schoolId,
        systemKey: input.systemKey,
      },
    },
  });

  if (existing) return existing;

  const communication = await prisma.communication.create({
    data: {
      schoolId: input.session.schoolId,
      authorUserId: input.session.id,
      systemKey: input.systemKey,
      title: input.title,
      content: input.content,
      priority: input.priority || "NORMAL",
      audience: "INDIVIDUAL_GUARDIAN",
      targetGuardianId: input.guardianId,
      requiresAcknowledgement:
        input.requiresAcknowledgement === true,
    },
  });

  await publishCommunication(communication.id, input.session);
  return communication;
}

export async function notifyReportClosed(input: {
  session: SessionUser;
  enrollmentId: string;
}) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: input.enrollmentId,
      class: { schoolId: input.session.schoolId },
    },
    include: {
      student: {
        include: {
          guardians: {
            where: { guardian: { status: "ACTIVE" } },
            include: { guardian: true },
          },
        },
      },
      class: true,
      academicResult: true,
    },
  });

  if (!enrollment) return;

  for (const link of enrollment.student.guardians) {
    await createAndPublishToGuardian({
      session: input.session,
      systemKey:
        "report-final:" +
        enrollment.id +
        ":" +
        link.guardianId,
      guardianId: link.guardianId,
      title:
        "Boletim final disponível — " +
        enrollment.student.name,
      content:
        "O resultado acadêmico de " +
        enrollment.student.name +
        " para " +
        enrollment.class.name +
        " / " +
        enrollment.class.schoolYear +
        " foi fechado. Acesse o Portal do Responsável para consultar o boletim e a situação final.",
      priority: "IMPORTANT",
      requiresAcknowledgement: true,
    });
  }
}

export async function notifyBillingSchedule(input: {
  session: SessionUser;
  contractId: string;
}) {
  const contract = await prisma.billingContract.findFirst({
    where: {
      id: input.contractId,
      schoolId: input.session.schoolId,
    },
    include: {
      guardian: true,
      enrollment: {
        include: { student: true, class: true },
      },
      charges: {
        orderBy: { installmentNumber: "asc" },
      },
    },
  });

  if (!contract?.guardian || !contract.charges.length) return;

  const first = contract.charges[0];
  const last = contract.charges[contract.charges.length - 1];

  await createAndPublishToGuardian({
    session: input.session,
    systemKey: "billing-schedule:" + contract.id,
    guardianId: contract.guardian.id,
    title:
      "Mensalidades disponíveis — " +
      contract.enrollment.student.name,
    content:
      "O financeiro de " +
      contract.enrollment.student.name +
      " foi disponibilizado. São " +
      contract.charges.length +
      " parcela(s), com vencimentos de " +
      first.dueDate.toLocaleDateString("pt-BR") +
      " até " +
      last.dueDate.toLocaleDateString("pt-BR") +
      ". Consulte valores e formas de pagamento no Portal do Responsável.",
    priority: "NORMAL",
  });
}

export async function notifyOverdueCharge(input: {
  session: SessionUser;
  chargeId: string;
}) {
  const charge = await prisma.charge.findFirst({
    where: {
      id: input.chargeId,
      schoolId: input.session.schoolId,
    },
    include: {
      guardian: true,
      student: true,
    },
  });

  if (!charge?.guardian) return;

  await createAndPublishToGuardian({
    session: input.session,
    systemKey: "charge-overdue:" + charge.id,
    guardianId: charge.guardian.id,
    title: "Mensalidade em atraso — " + charge.student.name,
    content:
      'A cobrança "' +
      charge.description +
      '" venceu em ' +
      charge.dueDate.toLocaleDateString("pt-BR") +
      " e ainda possui saldo em aberto. Consulte o Portal do Responsável para regularização ou entre em contato com o financeiro da escola.",
    priority: "IMPORTANT",
    requiresAcknowledgement: true,
  });
}

export async function notifyDueSoonCharge(input: {
  session: SessionUser;
  chargeId: string;
}) {
  const charge = await prisma.charge.findFirst({
    where: {
      id: input.chargeId,
      schoolId: input.session.schoolId,
    },
    include: {
      guardian: true,
      student: true,
    },
  });

  if (!charge?.guardian) return;

  await createAndPublishToGuardian({
    session: input.session,
    systemKey: "charge-due-soon:" + charge.id,
    guardianId: charge.guardian.id,
    title: "Mensalidade próxima do vencimento — " + charge.student.name,
    content:
      'A cobrança "' +
      charge.description +
      '" vence em ' +
      charge.dueDate.toLocaleDateString("pt-BR") +
      ". Consulte o Portal do Responsável para visualizar a cobrança e as formas de pagamento disponíveis.",
    priority: "NORMAL",
  });
}
