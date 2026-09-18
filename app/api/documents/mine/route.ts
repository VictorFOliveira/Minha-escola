import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  if (session.role === "STUDENT" && session.enrollmentId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: session.enrollmentId,
        class: { schoolId: session.schoolId },
      },
      select: { studentId: true },
    });

    if (!enrollment) {
      return NextResponse.json({ documents: [] });
    }

    const documents = await prisma.schoolDocument.findMany({
      where: {
        schoolId: session.schoolId,
        status: "ISSUED",
        OR: [
          { enrollmentId: session.enrollmentId },
          { studentId: enrollment.studentId },
        ],
      },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        issuedAt: true,
        verificationCode: true,
      },
    });

    return NextResponse.json({ documents });
  }

  if (session.role === "GUARDIAN" && session.guardianId) {
    const links = await prisma.studentGuardian.findMany({
      where: { guardianId: session.guardianId },
      select: { studentId: true },
    });

    const studentIds = links.map((item) => item.studentId);

    const documents = await prisma.schoolDocument.findMany({
      where: {
        schoolId: session.schoolId,
        status: "ISSUED",
        OR: [
          { guardianId: session.guardianId },
          { studentId: { in: studentIds } },
        ],
      },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        issuedAt: true,
        verificationCode: true,
        student: { select: { name: true } },
      },
    });

    return NextResponse.json({ documents });
  }

  return NextResponse.json({ documents: [] });
}
