import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertStudentLimit } from "@/lib/tenant-limits";
import { paginationFromRequest, paginationMeta } from "@/lib/pagination";

const allowedRoles = ["ADMIN", "SECRETARY"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const pagination = paginationFromRequest(request);
  const where = {
    schoolId: session.schoolId,
    ...(pagination.search
      ? {
          OR: [
            { name: { contains: pagination.search, mode: "insensitive" as const } },
            { registration: { contains: pagination.search, mode: "insensitive" as const } },
            { document: { contains: pagination.search, mode: "insensitive" as const } },
            { email: { contains: pagination.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        guardians: {
          include: { guardian: true },
        },
        enrollments: {
          include: { class: true },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  return NextResponse.json({
    students,
    meta: paginationMeta(total, pagination.page, pagination.pageSize),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    await assertStudentLimit(session.schoolId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Limite do plano atingido." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const registration = typeof body?.registration === "string" ? body.registration.trim() : "";

  if (!name || !registration) {
    return NextResponse.json({ error: "Nome e matrícula são obrigatórios." }, { status: 400 });
  }

  const existing = await prisma.student.findFirst({
    where: { schoolId: session.schoolId, registration },
  });

  if (existing) {
    return NextResponse.json({ error: "Já existe um aluno com esta matrícula." }, { status: 409 });
  }

  const student = await prisma.student.create({
    data: {
      schoolId: session.schoolId,
      name,
      registration,
      document: body?.document?.trim() || null,
      phone: body?.phone?.trim() || null,
      email: body?.email?.trim()?.toLowerCase() || null,
      address: body?.address?.trim() || null,
      birthDate: body?.birthDate ? new Date(body.birthDate) : null,
    },
  });

  return NextResponse.json({ student }, { status: 201 });
}
