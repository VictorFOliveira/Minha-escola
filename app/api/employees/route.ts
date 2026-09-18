import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { paginationFromRequest, paginationMeta } from "@/lib/pagination";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const pagination = paginationFromRequest(request, {
    defaultPageSize: 50,
    maxPageSize: 100,
    maxAll: 5000,
  });
  const where = {
    schoolId: session.schoolId,
    ...(pagination.search
      ? {
          OR: [
            { name: { contains: pagination.search, mode: "insensitive" as const } },
            { jobTitle: { contains: pagination.search, mode: "insensitive" as const } },
            { department: { contains: pagination.search, mode: "insensitive" as const } },
            { email: { contains: pagination.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.employee.count({ where }),
  ]);

  return NextResponse.json({
    employees,
    meta: paginationMeta(total, pagination.page, pagination.pageSize),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const jobTitle = typeof body?.jobTitle === "string" ? body.jobTitle.trim() : "";

  if (!name || !jobTitle) {
    return NextResponse.json({ error: "Nome e cargo são obrigatórios." }, { status: 400 });
  }

  const employee = await prisma.employee.create({
    data: {
      schoolId: session.schoolId,
      name,
      jobTitle,
      department: body?.department?.trim() || null,
      document: body?.document?.trim() || null,
      email: body?.email?.trim()?.toLowerCase() || null,
      phone: body?.phone?.trim() || null,
      hiredAt: body?.hiredAt ? new Date(body.hiredAt) : null,
    },
  });

  return NextResponse.json({ employee }, { status: 201 });
}
