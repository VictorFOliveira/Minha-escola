import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getChargeStatus } from "@/lib/finance";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status");
  const studentId = url.searchParams.get("studentId");

  const charges = await prisma.charge.findMany({
    where: {
      schoolId: session.schoolId,
      ...(studentId ? { studentId } : {}),
      ...(requestedStatus &&
      ["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"].includes(requestedStatus)
        ? { status: requestedStatus as any }
        : {}),
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: {
      student: true,
      guardian: true,
      enrollment: { include: { class: true } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  const updates = charges
    .map((charge) => {
      const next = getChargeStatus({
        amount: Number(charge.amount),
        paidAmount: Number(charge.paidAmount),
        dueDate: charge.dueDate,
        currentStatus: charge.status,
      });
      return next !== charge.status
        ? prisma.charge.update({
            where: { id: charge.id },
            data: { status: next },
          })
        : null;
    })
    .filter(Boolean);

  if (updates.length) await prisma.$transaction(updates as any);

  return NextResponse.json({
    charges: charges.map((charge) => ({
      ...charge,
      status: getChargeStatus({
        amount: Number(charge.amount),
        paidAmount: Number(charge.paidAmount),
        dueDate: charge.dueDate,
        currentStatus: charge.status,
      }),
    })),
  });
}
