import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

type DocumentAccessTarget = {
  id: string;
  schoolId: string;
  type: string;
  studentId: string | null;
  enrollmentId: string | null;
  guardianId: string | null;
};

export async function canAccessSchoolDocument(
  session: SessionUser,
  document: DocumentAccessTarget,
) {
  if (document.schoolId !== session.schoolId) return false;

  if (["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role)) {
    return true;
  }

  if (session.role === "FINANCE") {
    return document.type === "PAYMENT_RECEIPT";
  }

  if (session.role === "STUDENT" && session.enrollmentId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: session.enrollmentId,
        class: { schoolId: session.schoolId },
      },
      select: { studentId: true },
    });

    return Boolean(
      enrollment &&
        (document.enrollmentId === session.enrollmentId ||
          document.studentId === enrollment.studentId),
    );
  }

  if (session.role === "GUARDIAN" && session.guardianId) {
    if (document.guardianId === session.guardianId) return true;
    if (!document.studentId) return false;

    const link = await prisma.studentGuardian.findUnique({
      where: {
        studentId_guardianId: {
          studentId: document.studentId,
          guardianId: session.guardianId,
        },
      },
      select: { studentId: true },
    });

    return Boolean(link);
  }

  return false;
}
