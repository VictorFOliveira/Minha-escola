import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      class: { schoolId: session.schoolId },
      status: { not: "CANCELLED" },
    },
    orderBy: [
      { class: { schoolYear: "desc" } },
      { student: { name: "asc" } },
    ],
    include: {
      student: true,
      class: true,
    },
  });

  const charges = await prisma.charge.findMany({
    where: {
      schoolId: session.schoolId,
      paidAmount: { gt: 0 },
      status: { in: ["PARTIAL", "PAID", "REFUNDED"] },
    },
    orderBy: { paidAt: "desc" },
    include: {
      student: true,
      guardian: true,
    },
  });

  return NextResponse.json({
    enrollments: enrollments.map((item) => ({
      id: item.id,
      status: item.status,
      student: {
        id: item.student.id,
        name: item.student.name,
        registration: item.student.registration,
      },
      class: {
        id: item.class.id,
        name: item.class.name,
        gradeLevel: item.class.gradeLevel,
        schoolYear: item.class.schoolYear,
      },
    })),
    charges: charges.map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount,
      paidAmount: item.paidAmount,
      paidAt: item.paidAt,
      student: {
        id: item.student.id,
        name: item.student.name,
        registration: item.student.registration,
      },
      guardian: item.guardian
        ? { id: item.guardian.id, name: item.guardian.name }
        : null,
    })),
  });
}
