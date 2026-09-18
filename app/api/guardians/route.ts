import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
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
            { document: { contains: pagination.search, mode: "insensitive" as const } },
            { phone: { contains: pagination.search, mode: "insensitive" as const } },
            { email: { contains: pagination.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [guardians, total] = await Promise.all([
    prisma.guardian.findMany({
      where,
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        students: {
          include: { student: true },
        },
      },
    }),
    prisma.guardian.count({ where }),
  ]);

  return NextResponse.json({
    guardians,
    meta: paginationMeta(total, pagination.page, pagination.pageSize),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!name || !phone) {
    return NextResponse.json({ error: "Nome e telefone são obrigatórios." }, { status: 400 });
  }

  const guardian = await prisma.guardian.create({
    data: {
      schoolId: session.schoolId,
      name,
      phone,
      document: body?.document?.trim() || null,
      email: body?.email?.trim()?.toLowerCase() || null,
      address: body?.address?.trim() || null,
    },
  });

  return NextResponse.json({ guardian }, { status: 201 });
}
