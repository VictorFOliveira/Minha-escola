import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { auditUserAction } from "@/lib/audit";

export async function subjectForSession(session: SessionUser) {
  if (session.role === "STUDENT" && session.enrollmentId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: session.enrollmentId,
        class: { schoolId: session.schoolId },
      },
      select: { studentId: true },
    });

    if (!enrollment) throw new Error("Matrícula do titular não encontrada.");

    return {
      subjectType: "STUDENT" as const,
      subjectId: enrollment.studentId,
    };
  }

  if (session.role === "GUARDIAN" && session.guardianId) {
    return {
      subjectType: "GUARDIAN" as const,
      subjectId: session.guardianId,
    };
  }

  return {
    subjectType: "USER" as const,
    subjectId: session.id,
  };
}

export async function buildPersonalExport(session: SessionUser) {
  const subject = await subjectForSession(session);

  if (subject.subjectType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: {
        id: subject.subjectId,
        schoolId: session.schoolId,
      },
      include: {
        guardians: {
          select: {
            relationship: true,
            financialResponsible: true,
            authorizedPickup: true,
            guardian: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        enrollments: {
          include: {
            class: true,
            assessmentScores: true,
            feedbacks: true,
            lessonAttendances: true,
            periodGrades: true,
            subjectResults: true,
            academicResult: true,
          },
        },
        schoolDocuments: {
          select: {
            id: true,
            type: true,
            title: true,
            verificationCode: true,
            issuedAt: true,
            status: true,
          },
        },
      },
    });

    return { subject, data: student };
  }

  if (subject.subjectType === "GUARDIAN") {
    const guardian = await prisma.guardian.findFirst({
      where: {
        id: subject.subjectId,
        schoolId: session.schoolId,
      },
      include: {
        students: {
          select: {
            relationship: true,
            financialResponsible: true,
            authorizedPickup: true,
            student: {
              select: {
                id: true,
                name: true,
                registration: true,
              },
            },
          },
        },
        charges: {
          select: {
            id: true,
            description: true,
            amount: true,
            paidAmount: true,
            dueDate: true,
            paidAt: true,
            status: true,
          },
        },
        authorizationRequests: {
          select: {
            id: true,
            status: true,
            responseNote: true,
            respondedAt: true,
          },
        },
        schoolDocuments: {
          select: {
            id: true,
            type: true,
            title: true,
            verificationCode: true,
            issuedAt: true,
            status: true,
          },
        },
      },
    });

    return { subject, data: guardian };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: subject.subjectId,
      schoolId: session.schoolId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
      consents: true,
    },
  });

  return { subject, data: user };
}

export async function executePrivacyRequest(input: {
  requestId: string;
  schoolId: string;
  adminUserId: string;
}) {
  const request = await prisma.dataPrivacyRequest.findFirst({
    where: {
      id: input.requestId,
      schoolId: input.schoolId,
      status: { in: ["OPEN", "IN_REVIEW"] },
    },
  });

  if (!request) {
    throw new Error("Solicitação LGPD não encontrada ou já concluída.");
  }

  if (!["ANONYMIZATION", "DELETION"].includes(request.type)) {
    throw new Error("Esta solicitação não exige anonimização.");
  }

  const suffix = request.subjectId.slice(-8).toLowerCase();

  if (request.subjectType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: {
        id: request.subjectId,
        schoolId: input.schoolId,
      },
      include: {
        enrollments: {
          where: { status: { in: ["ACTIVE", "PENDING"] } },
          select: { id: true },
        },
        charges: {
          where: {
            status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          },
          select: { id: true },
        },
      },
    });

    if (!student) throw new Error("Aluno não encontrado.");
    if (student.enrollments.length) {
      throw new Error("Aluno possui matrícula ativa/pendente e não pode ser anonimizado.");
    }
    if (student.charges.length) {
      throw new Error("Aluno possui cobrança em aberto e não pode ser anonimizado.");
    }

    await prisma.student.update({
      where: { id: student.id },
      data: {
        name: "Titular anonimizado " + suffix,
        registration: "ANON-" + suffix,
        birthDate: null,
        document: null,
        phone: null,
        email: null,
        address: null,
        status: "INACTIVE",
      },
    });
  } else if (request.subjectType === "GUARDIAN") {
    const guardian = await prisma.guardian.findFirst({
      where: {
        id: request.subjectId,
        schoolId: input.schoolId,
      },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  where: { status: { in: ["ACTIVE", "PENDING"] } },
                  select: { id: true },
                },
              },
            },
          },
        },
        charges: {
          where: {
            status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          },
          select: { id: true },
        },
        portalUser: true,
      },
    });

    if (!guardian) throw new Error("Responsável não encontrado.");

    const hasActiveStudent = guardian.students.some(
      (link) => link.student.enrollments.length > 0,
    );

    if (hasActiveStudent) {
      throw new Error("Responsável ainda está vinculado a aluno com matrícula ativa.");
    }
    if (guardian.charges.length) {
      throw new Error("Responsável possui cobrança em aberto.");
    }

    await prisma.$transaction(async (tx) => {
      if (guardian.portalUser) {
        await tx.user.update({
          where: { id: guardian.portalUser.id },
          data: {
            name: "Usuário anonimizado " + suffix,
            email: "anon-" + suffix + "@invalid.local",
            password: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
            active: false,
            guardianId: null,
          },
        });
      }

      await tx.guardian.update({
        where: { id: guardian.id },
        data: {
          name: "Responsável anonimizado " + suffix,
          document: null,
          phone: "ANON-" + suffix,
          email: null,
          address: null,
          status: "INACTIVE",
        },
      });
    });
  } else {
    const user = await prisma.user.findFirst({
      where: {
        id: request.subjectId,
        schoolId: input.schoolId,
      },
    });

    if (!user) throw new Error("Usuário não encontrado.");
    if (user.active) {
      throw new Error("Desative a conta antes de anonimizar o usuário.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: "Usuário anonimizado " + suffix,
        email: "anon-" + suffix + "@invalid.local",
        password: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
        enrollmentId: null,
        guardianId: null,
        teacherId: null,
      },
    });
  }

  const resolution =
    request.type === "DELETION"
      ? "Dados identificadores anonimizados; registros acadêmicos, financeiros e de auditoria preservados conforme política institucional."
      : "Dados identificadores anonimizados com preservação dos registros necessários.";

  const updated = await prisma.dataPrivacyRequest.update({
    where: { id: request.id },
    data: {
      status: "COMPLETED",
      processedByUserId: input.adminUserId,
      processedAt: new Date(),
      resolution,
    },
  });

  await auditUserAction({
    schoolId: input.schoolId,
    userId: input.adminUserId,
    action: "PRIVACY_REQUEST_EXECUTE",
    entityType: "DataPrivacyRequest",
    entityId: request.id,
    metadata: {
      type: request.type,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
    },
  }).catch(() => null);

  return updated;
}
