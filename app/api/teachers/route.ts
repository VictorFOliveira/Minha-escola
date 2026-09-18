import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { paginationFromRequest, paginationMeta } from "@/lib/pagination";
import {
  idempotencyHash,
  readIdempotency,
  saveIdempotency,
} from "@/lib/idempotency";

const allowedRoles = ["ADMIN", "SECRETARY"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const pagination = paginationFromRequest(request, {
    defaultPageSize: 100,
    maxPageSize: 250,
    maxAll: 5000,
  });

  const where = {
    schoolId: session.schoolId,
    ...(pagination.search
      ? {
          OR: [
            { name: { contains: pagination.search, mode: "insensitive" as const } },
            { document: { contains: pagination.search, mode: "insensitive" as const } },
            { email: { contains: pagination.search, mode: "insensitive" as const } },
            { specialty: { contains: pagination.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.teacher.count({ where }),
  ]);

  return NextResponse.json({
    teachers,
    meta: paginationMeta(total, pagination.page, pagination.pageSize),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const operation = "teacher.create";
  const previous = await readIdempotency(
    request,
    session.schoolId,
    operation,
  ).catch(() => null);

  if (previous?.responseBody && previous.responseStatus) {
    return NextResponse.json(previous.responseBody, {
      status: previous.responseStatus,
      headers: { "Idempotent-Replay": "true" },
    });
  }

  const keyHash = idempotencyHash(request, session.schoolId, operation);
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const teacher = await prisma.teacher.create({
    data: {
      schoolId: session.schoolId,
      name,
      document: body?.document?.trim() || null,
      email: body?.email?.trim()?.toLowerCase() || null,
      phone: body?.phone?.trim() || null,
      specialty: body?.specialty?.trim() || null,
    },
  });

  const responseBody = { teacher };

  await saveIdempotency({
    schoolId: session.schoolId,
    operation,
    keyHash,
    responseStatus: 201,
    responseBody,
    resourceId: teacher.id,
  }).catch(() => null);

  return NextResponse.json(responseBody, { status: 201 });
}
