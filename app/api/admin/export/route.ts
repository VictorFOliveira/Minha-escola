import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { auditUserAction } from "@/lib/audit";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return new Response("Não autenticado.", { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return new Response("Acesso negado.", { status: 403 });
  }

  const [
    school,
    users,
    students,
    guardians,
    teachers,
    employees,
    classes,
    enrollments,
    communications,
    documents,
    charges,
    payments,
  ] = await Promise.all([
    prisma.school.findUnique({
      where: { id: session.schoolId },
      include: {
        subscription: { include: { plan: true } },
      },
    }),
    prisma.user.findMany({
      where: { schoolId: session.schoolId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.student.findMany({
      where: { schoolId: session.schoolId },
    }),
    prisma.guardian.findMany({
      where: { schoolId: session.schoolId },
    }),
    prisma.teacher.findMany({
      where: { schoolId: session.schoolId },
    }),
    prisma.employee.findMany({
      where: { schoolId: session.schoolId },
    }),
    prisma.classGroup.findMany({
      where: { schoolId: session.schoolId },
    }),
    prisma.enrollment.findMany({
      where: { class: { schoolId: session.schoolId } },
    }),
    prisma.communication.findMany({
      where: { schoolId: session.schoolId },
      include: {
        recipients: true,
        authorizationRequests: true,
      },
    }),
    prisma.schoolDocument.findMany({
      where: { schoolId: session.schoolId },
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        studentId: true,
        enrollmentId: true,
        guardianId: true,
        chargeId: true,
        issuedByUserId: true,
        verificationCode: true,
        snapshot: true,
        issuedAt: true,
        cancelledAt: true,
        cancellationReason: true,
      },
    }),
    prisma.charge.findMany({
      where: { schoolId: session.schoolId },
    }),
    prisma.payment.findMany({
      where: { charge: { schoolId: session.schoolId } },
    }),
  ]);

  const exportedAt = new Date();

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "DATA_EXPORT",
    entityType: "School",
    entityId: session.schoolId,
    metadata: { exportedAt: exportedAt.toISOString() },
  }).catch(() => null);

  const payload = {
    exportedAt,
    school,
    users,
    students,
    guardians,
    teachers,
    employees,
    classes,
    enrollments,
    communications,
    documents,
    charges,
    payments,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="minha-escola-export-' +
        exportedAt.toISOString().slice(0, 10) +
        '.json"',
      "Cache-Control": "no-store",
    },
  });
}
