import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getChargeStatus } from "@/lib/finance";
import { paginationFromRequest, paginationMeta } from "@/lib/pagination";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status");
  const studentId = url.searchParams.get("studentId");
  const pagination = paginationFromRequest(request, {
    defaultPageSize: 50,
    maxPageSize: 200,
    maxAll: 5000,
  });

  const where = {
    schoolId: session.schoolId,
    ...(studentId ? { studentId } : {}),
    ...(requestedStatus &&
    ["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"].includes(requestedStatus)
      ? { status: requestedStatus as any }
      : {}),
    ...(pagination.search
      ? {
          OR: [
            { description: { contains: pagination.search, mode: "insensitive" as const } },
            { student: { name: { contains: pagination.search, mode: "insensitive" as const } } },
            { guardian: { name: { contains: pagination.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [charges, total] = await Promise.all([
    prisma.charge.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        student: true,
        guardian: true,
        enrollment: { include: { class: true } },
        payments: {
          orderBy: { paidAt: "desc" },
          take: 20,
        },
      },
    }),
    prisma.charge.count({ where }),
  ]);

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
    meta: paginationMeta(total, pagination.page, pagination.pageSize),
  });
}
