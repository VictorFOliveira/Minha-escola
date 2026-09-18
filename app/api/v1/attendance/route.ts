import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApi } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "attendance:read");
  if (!auth) {
    return NextResponse.json({ error: "Credencial inválida." }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 50)));

  const where = {
    lesson: {
      classSubject: {
        class: { schoolId: auth.schoolId },
      },
    },
  };

  const [total, attendance] = await Promise.all([
    prisma.lessonAttendance.count({ where }),
    prisma.lessonAttendance.findMany({
      where,
      orderBy: { lesson: { lessonDate: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        note: true,
        lesson: {
          select: {
            id: true,
            lessonDate: true,
            classSubject: {
              select: {
                subject: { select: { id: true, name: true } },
                class: { select: { id: true, name: true, schoolYear: true } },
              },
            },
          },
        },
        enrollment: {
          select: {
            id: true,
            student: {
              select: { id: true, registration: true, name: true },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: attendance,
    meta: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
  });
}
