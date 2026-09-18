import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApi } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "finance:read");
  if (!auth) {
    return NextResponse.json({ error: "Credencial inválida." }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 50)));
  const status = url.searchParams.get("status");

  const where = {
    schoolId: auth.schoolId,
    ...(status && ["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"].includes(status)
      ? { status: status as any }
      : {}),
  };

  const [total, charges] = await Promise.all([
    prisma.charge.count({ where }),
    prisma.charge.findMany({
      where,
      orderBy: { dueDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        description: true,
        installmentNumber: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        paidAt: true,
        status: true,
        provider: true,
        externalId: true,
        student: {
          select: { id: true, registration: true, name: true },
        },
        guardian: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: charges,
    meta: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
  });
}
