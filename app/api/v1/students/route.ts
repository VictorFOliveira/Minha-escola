import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApi } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "students:read");
  if (!auth) {
    return NextResponse.json({ error: "Credencial inválida." }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 50)));
  const search = url.searchParams.get("search")?.trim();

  const where = {
    schoolId: auth.schoolId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { registration: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        registration: true,
        name: true,
        birthDate: true,
        document: true,
        phone: true,
        email: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    data: students,
    meta: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
  });
}
