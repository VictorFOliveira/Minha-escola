import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      class: { schoolId: session.schoolId },
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: [
      { class: { schoolYear: "desc" } },
      { student: { name: "asc" } },
    ],
    include: {
      student: {
        include: {
          guardians: {
            where: { financialResponsible: true },
            include: { guardian: true },
          },
        },
      },
      class: true,
      billingContract: { select: { id: true, status: true } },
    },
    take: 5000,
  });

  return NextResponse.json({
    enrollments: enrollments.map((enrollment) => ({
      id: enrollment.id,
      status: enrollment.status,
      student: {
        id: enrollment.student.id,
        name: enrollment.student.name,
        registration: enrollment.student.registration,
      },
      class: {
        id: enrollment.class.id,
        name: enrollment.class.name,
        schoolYear: enrollment.class.schoolYear,
      },
      financialGuardian:
        enrollment.student.guardians.find(
          (link) => link.guardian.status === "ACTIVE",
        )?.guardian || null,
      billingContract: enrollment.billingContract,
    })),
  });
}
