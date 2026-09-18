import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApi } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "enrollments:read");
  if (!auth) {
    return NextResponse.json({ error: "Credencial inválida." }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 50)));
  const schoolYear = Number(url.searchParams.get("schoolYear") || 0);

  const where = {
    class: {
      schoolId: auth.schoolId,
      ...(Number.isInteger(schoolYear) && schoolYear > 0 ? { schoolYear } : {}),
    },
  };

  const [total, enrollments] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({
      where,
      orderBy: [{ class: { schoolYear: "desc" } }, { student: { name: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        status: true,
        startedAt: true,
        endedAt: true,
        student: {
          select: { id: true, registration: true, name: true },
        },
        class: {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            shift: true,
            schoolYear: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: enrollments,
    meta: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
  });
}
