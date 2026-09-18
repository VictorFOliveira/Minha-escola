import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

type Audience =
  | "SCHOOL"
  | "STAFF"
  | "STUDENTS"
  | "GUARDIANS"
  | "FINANCIAL_GUARDIANS"
  | "CLASS_STUDENTS"
  | "CLASS_GUARDIANS"
  | "CLASS_BOTH"
  | "INDIVIDUAL_STUDENT"
  | "INDIVIDUAL_GUARDIAN";

export type ResolvedRecipient = {
  recipientKey: string;
  userId?: string | null;
  guardianId?: string | null;
  enrollmentId?: string | null;
  destinationEmail?: string | null;
  destinationPhone?: string | null;
};

export async function canTargetClass(
  session: SessionUser,
  classId: string,
) {
  if (["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role)) {
    return prisma.classGroup.findFirst({
      where: { id: classId, schoolId: session.schoolId },
      select: { id: true },
    });
  }

  if (session.role === "TEACHER" && session.teacherId) {
    return prisma.classGroup.findFirst({
      where: {
        id: classId,
        schoolId: session.schoolId,
        classSubjects: {
          some: { teacherId: session.teacherId },
        },
      },
      select: { id: true },
    });
  }

  return null;
}

export function canCreateAudience(
  session: SessionUser,
  audience: Audience,
) {
  if (["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role)) {
    return true;
  }

  if (session.role === "TEACHER") {
    return [
      "CLASS_STUDENTS",
      "CLASS_GUARDIANS",
      "CLASS_BOTH",
      "INDIVIDUAL_STUDENT",
      "INDIVIDUAL_GUARDIAN",
    ].includes(audience);
  }

  if (session.role === "FINANCE") {
    return [
      "FINANCIAL_GUARDIANS",
      "INDIVIDUAL_GUARDIAN",
    ].includes(audience);
  }

  return false;
}

function dedupe(recipients: ResolvedRecipient[]) {
  const map = new Map<string, ResolvedRecipient>();

  for (const recipient of recipients) {
    map.set(recipient.recipientKey, recipient);
  }

  return Array.from(map.values());
}

async function studentRecipientsForClass(classId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    include: {
      portalUser: { select: { id: true, active: true } },
      student: true,
    },
  });

  return enrollments.map((enrollment) => ({
    recipientKey: "enrollment:" + enrollment.id,
    enrollmentId: enrollment.id,
    userId: enrollment.portalUser?.active
      ? enrollment.portalUser.id
      : null,
    destinationEmail: enrollment.student.email,
    destinationPhone: enrollment.student.phone,
  }));
}

async function guardianRecipientsForClass(
  classId: string,
  financialOnly = false,
) {
  const links = await prisma.studentGuardian.findMany({
    where: {
      ...(financialOnly ? { financialResponsible: true } : {}),
      guardian: { status: "ACTIVE" },
      student: {
        enrollments: {
          some: {
            classId,
            status: { in: ["ACTIVE", "PENDING"] },
          },
        },
      },
    },
    include: {
      guardian: {
        include: {
          portalUser: { select: { id: true, active: true } },
        },
      },
    },
  });

  return dedupe(
    links.map((link) => ({
      recipientKey: "guardian:" + link.guardianId,
      guardianId: link.guardianId,
      userId: link.guardian.portalUser?.active
        ? link.guardian.portalUser.id
        : null,
      destinationEmail: link.guardian.email,
      destinationPhone: link.guardian.phone,
    })),
  );
}

export async function resolveCommunicationRecipients(input: {
  session: SessionUser;
  audience: Audience;
  targetClassId?: string | null;
  targetEnrollmentId?: string | null;
  targetGuardianId?: string | null;
}): Promise<ResolvedRecipient[]> {
  const {
    session,
    audience,
    targetClassId,
    targetEnrollmentId,
    targetGuardianId,
  } = input;

  if (!canCreateAudience(session, audience)) {
    throw new Error("Público não permitido para este perfil.");
  }

  if (
    [
      "CLASS_STUDENTS",
      "CLASS_GUARDIANS",
      "CLASS_BOTH",
    ].includes(audience)
  ) {
    if (!targetClassId) {
      throw new Error("Selecione uma turma.");
    }

    const allowedClass = await canTargetClass(session, targetClassId);
    if (!allowedClass) {
      throw new Error("Turma não encontrada ou sem acesso.");
    }

    const students =
      audience === "CLASS_GUARDIANS"
        ? []
        : await studentRecipientsForClass(targetClassId);
    const guardians =
      audience === "CLASS_STUDENTS"
        ? []
        : await guardianRecipientsForClass(targetClassId);

    return dedupe([...students, ...guardians]);
  }

  if (audience === "INDIVIDUAL_STUDENT") {
    if (!targetEnrollmentId) {
      throw new Error("Selecione a matrícula do aluno.");
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: targetEnrollmentId,
        class: {
          schoolId: session.schoolId,
          ...(session.role === "TEACHER" && session.teacherId
            ? {
                classSubjects: {
                  some: { teacherId: session.teacherId },
                },
              }
            : {}),
        },
      },
      include: {
        portalUser: { select: { id: true, active: true } },
        student: true,
      },
    });

    if (!enrollment) {
      throw new Error("Matrícula não encontrada ou sem acesso.");
    }

    return [{
      recipientKey: "enrollment:" + enrollment.id,
      enrollmentId: enrollment.id,
      userId: enrollment.portalUser?.active
        ? enrollment.portalUser.id
        : null,
      destinationEmail: enrollment.student.email,
      destinationPhone: enrollment.student.phone,
    }];
  }

  if (audience === "INDIVIDUAL_GUARDIAN") {
    if (!targetGuardianId) {
      throw new Error("Selecione o responsável.");
    }

    const guardian = await prisma.guardian.findFirst({
      where: {
        id: targetGuardianId,
        schoolId: session.schoolId,
        status: "ACTIVE",
        ...(session.role === "TEACHER" && session.teacherId
          ? {
              students: {
                some: {
                  student: {
                    enrollments: {
                      some: {
                        status: { in: ["ACTIVE", "PENDING"] },
                        class: {
                          classSubjects: {
                            some: { teacherId: session.teacherId },
                          },
                        },
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
      include: {
        portalUser: { select: { id: true, active: true } },
      },
    });

    if (!guardian) {
      throw new Error("Responsável não encontrado ou sem acesso.");
    }

    return [{
      recipientKey: "guardian:" + guardian.id,
      guardianId: guardian.id,
      userId: guardian.portalUser?.active
        ? guardian.portalUser.id
        : null,
      destinationEmail: guardian.email,
      destinationPhone: guardian.phone,
    }];
  }

  if (audience === "STAFF") {
    const users = await prisma.user.findMany({
      where: {
        schoolId: session.schoolId,
        active: true,
        role: {
          in: ["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER", "FINANCE"],
        },
      },
      select: { id: true, email: true },
    });

    return users.map((user) => ({
      recipientKey: "user:" + user.id,
      userId: user.id,
      destinationEmail: user.email,
    }));
  }

  if (audience === "STUDENTS" || audience === "SCHOOL") {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        status: { in: ["ACTIVE", "PENDING"] },
        class: { schoolId: session.schoolId },
      },
      include: {
        portalUser: { select: { id: true, active: true } },
        student: true,
      },
    });

    const students = enrollments.map((enrollment) => ({
      recipientKey: "enrollment:" + enrollment.id,
      enrollmentId: enrollment.id,
      userId: enrollment.portalUser?.active
        ? enrollment.portalUser.id
        : null,
      destinationEmail: enrollment.student.email,
      destinationPhone: enrollment.student.phone,
    }));

    if (audience === "STUDENTS") return dedupe(students);

    const guardians: ResolvedRecipient[] =
      await resolveCommunicationRecipients({
        session,
        audience: "GUARDIANS",
      });

    return dedupe([...students, ...guardians]);
  }

  if (
    audience === "GUARDIANS" ||
    audience === "FINANCIAL_GUARDIANS"
  ) {
    const links = await prisma.studentGuardian.findMany({
      where: {
        ...(audience === "FINANCIAL_GUARDIANS"
          ? { financialResponsible: true }
          : {}),
        guardian: {
          schoolId: session.schoolId,
          status: "ACTIVE",
        },
        student: {
          enrollments: {
            some: {
              status: { in: ["ACTIVE", "PENDING"] },
              class: { schoolId: session.schoolId },
            },
          },
        },
      },
      include: {
        guardian: {
          include: {
            portalUser: { select: { id: true, active: true } },
          },
        },
      },
    });

    return dedupe(
      links.map((link) => ({
        recipientKey: "guardian:" + link.guardianId,
        guardianId: link.guardianId,
        userId: link.guardian.portalUser?.active
          ? link.guardian.portalUser.id
          : null,
        destinationEmail: link.guardian.email,
        destinationPhone: link.guardian.phone,
      })),
    );
  }

  return [];
}



async function resolveAuthorizationPairs(input: {
  session: SessionUser;
  audience: Audience;
  targetClassId?: string | null;
  targetEnrollmentId?: string | null;
  targetGuardianId?: string | null;
}) {
  const { session, audience, targetClassId, targetEnrollmentId, targetGuardianId } = input;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "PENDING"] },
      class: {
        schoolId: session.schoolId,
        ...(targetClassId ? { id: targetClassId } : {}),
        ...(session.role === "TEACHER" && session.teacherId
          ? {
              classSubjects: {
                some: { teacherId: session.teacherId },
              },
            }
          : {}),
      },
      ...(targetEnrollmentId ? { id: targetEnrollmentId } : {}),
      ...(targetGuardianId
        ? {
            student: {
              guardians: {
                some: {
                  guardianId: targetGuardianId,
                  guardian: { status: "ACTIVE" },
                },
              },
            },
          }
        : {}),
    },
    include: {
      student: {
        include: {
          guardians: {
            where: { guardian: { status: "ACTIVE" } },
            include: { guardian: true },
            orderBy: { financialResponsible: "desc" },
          },
        },
      },
    },
  });

  return enrollments.flatMap((enrollment) => {
    let link = targetGuardianId
      ? enrollment.student.guardians.find(
          (item) => item.guardianId === targetGuardianId,
        )
      : enrollment.student.guardians.find(
          (item) => item.financialResponsible,
        ) || enrollment.student.guardians[0];

    if (
      audience === "INDIVIDUAL_STUDENT" ||
      audience === "STUDENTS" ||
      audience === "CLASS_STUDENTS"
    ) {
      link =
        enrollment.student.guardians.find(
          (item) => item.financialResponsible,
        ) || enrollment.student.guardians[0];
    }

    return link
      ? [{
          studentId: enrollment.studentId,
          guardianId: link.guardianId,
        }]
      : [];
  });
}

export async function publishCommunication(
  communicationId: string,
  session: SessionUser,
) {
  const communication = await prisma.communication.findFirst({
    where: {
      id: communicationId,
      schoolId: session.schoolId,
    },
  });

  if (!communication) {
    throw new Error("Comunicado não encontrado.");
  }

  const recipients = await resolveCommunicationRecipients({
    session,
    audience: communication.audience,
    targetClassId: communication.targetClassId,
    targetEnrollmentId: communication.targetEnrollmentId,
    targetGuardianId: communication.targetGuardianId,
  });

  if (!recipients.length) {
    throw new Error("O público selecionado não possui destinatários.");
  }

  const settings = await prisma.communicationSettings.findUnique({
    where: { schoolId: session.schoolId },
  });

  const portalEnabled = settings?.portalEnabled !== false;
  const emailEnabled = settings?.emailEnabled === true;
  const whatsappEnabled = settings?.whatsappEnabled === true;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.communicationRecipient.deleteMany({
      where: { communicationId },
    });

    for (const recipient of recipients) {
      const created = await tx.communicationRecipient.create({
        data: {
          communicationId,
          recipientKey: recipient.recipientKey,
          userId: recipient.userId || null,
          guardianId: recipient.guardianId || null,
          enrollmentId: recipient.enrollmentId || null,
        },
      });

      await tx.communicationDelivery.createMany({
        data: [
          {
            recipientId: created.id,
            channel: "PORTAL",
            status: portalEnabled ? "SENT" : "SKIPPED",
            sentAt: portalEnabled ? now : null,
          },
          {
            recipientId: created.id,
            channel: "EMAIL",
            status:
              emailEnabled && recipient.destinationEmail
                ? "PENDING"
                : "SKIPPED",
            destination: recipient.destinationEmail || null,
          },
          {
            recipientId: created.id,
            channel: "WHATSAPP",
            status:
              whatsappEnabled && recipient.destinationPhone
                ? "PENDING"
                : "SKIPPED",
            destination: recipient.destinationPhone || null,
          },
        ],
      });
    }

    if (communication.requiresAuthorization) {
      const authorizationPairs = await resolveAuthorizationPairs({
        session,
        audience: communication.audience,
        targetClassId: communication.targetClassId,
        targetEnrollmentId: communication.targetEnrollmentId,
        targetGuardianId: communication.targetGuardianId,
      });

      await tx.authorizationRequest.deleteMany({
        where: { communicationId },
      });

      for (const pair of authorizationPairs) {
        await tx.authorizationRequest.create({
          data: {
            communicationId,
            studentId: pair.studentId,
            guardianId: pair.guardianId,
          },
        });
      }
    }

    await tx.communication.update({
      where: { id: communicationId },
      data: {
        status: "PUBLISHED",
        publishAt: communication.publishAt || now,
      },
    });
  });

  return recipients.length;
}
