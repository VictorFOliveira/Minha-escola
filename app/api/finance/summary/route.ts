import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const charges = await prisma.charge.findMany({
    where: { schoolId: session.schoolId, status: { not: "CANCELLED" } },
    select: {
      amount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
      guardianId: true,
    },
  });

  const now = new Date();
  let totalReceivable = 0;
  let totalReceived = 0;
  let overdue = 0;
  let open = 0;
  const overdueGuardians = new Set<string>();

  for (const charge of charges) {
    const amount = Number(charge.amount);
    const paid = Number(charge.paidAmount);
    totalReceived += paid;
    const remaining = Math.max(0, amount - paid);
    totalReceivable += remaining;

    const isOverdue =
      remaining > 0 &&
      charge.status !== "REFUNDED" &&
      charge.dueDate.getTime() < now.getTime();

    if (isOverdue) {
      overdue += remaining;
      if (charge.guardianId) overdueGuardians.add(charge.guardianId);
    } else if (remaining > 0) {
      open += remaining;
    }
  }

  return NextResponse.json({
    summary: {
      totalReceived,
      totalReceivable,
      open,
      overdue,
      overdueGuardians: overdueGuardians.size,
      charges: charges.length,
    },
  });
}
