import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

export function canManageAcademicGlobally(role: SessionUser["role"]) {
  return role === "ADMIN" || role === "COORDINATOR";
}

export async function canAccessClassSubject(
  session: SessionUser,
  classSubjectId: string,
) {
  const classSubject = await prisma.classSubject.findFirst({
    where: {
      id: classSubjectId,
      class: { schoolId: session.schoolId },
    },
    include: {
      class: true,
      subject: true,
      teacher: true,
    },
  });

  if (!classSubject) return null;

  if (canManageAcademicGlobally(session.role)) return classSubject;

  if (
    session.role === "TEACHER" &&
    session.teacherId &&
    classSubject.teacherId === session.teacherId
  ) {
    return classSubject;
  }

  return null;
}

export async function canAccessEnrollmentAcademic(
  session: SessionUser,
  enrollmentId: string,
) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      class: { schoolId: session.schoolId },
    },
    include: {
      student: true,
      class: true,
    },
  });

  if (!enrollment) return null;

  if (canManageAcademicGlobally(session.role)) return enrollment;

  if (session.role === "STUDENT" && session.enrollmentId === enrollment.id) {
    return enrollment;
  }

  if (session.role === "GUARDIAN" && session.guardianId) {
    const link = await prisma.studentGuardian.findUnique({
      where: {
        studentId_guardianId: {
          studentId: enrollment.studentId,
          guardianId: session.guardianId,
        },
      },
    });

    if (link) return enrollment;
  }

  if (session.role === "TEACHER" && session.teacherId) {
    const teaching = await prisma.classSubject.findFirst({
      where: {
        classId: enrollment.classId,
        teacherId: session.teacherId,
      },
      select: { id: true },
    });

    if (teaching) return enrollment;
  }

  return null;
}
