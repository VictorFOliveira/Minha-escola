import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const readRoles = ["ADMIN", "SECRETARY", "TEACHER"];
const writeRoles = ["ADMIN", "SECRETARY"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!readRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("schoolYear");
  const year = yearParam ? Number(yearParam) : null;

  const periods = await prisma.academicPeriod.findMany({
    where: {
      schoolId: session.schoolId,
      ...(Number.isInteger(year) ? { schoolYear: year as number } : {}),
    },
    orderBy: [{ schoolYear: "desc" }, { order: "asc" }],
  });

  return NextResponse.json({ periods });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const schoolYear = Number(body?.schoolYear);
  const order = Number(body?.order);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const startDate = body?.startDate ? new Date(body.startDate) : null;
  const endDate = body?.endDate ? new Date(body.endDate) : null;

  if (
    !Number.isInteger(schoolYear) ||
    schoolYear < 2000 ||
    schoolYear > 2100 ||
    !Number.isInteger(order) ||
    order <= 0 ||
    !name ||
    !startDate ||
    !endDate ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return NextResponse.json({ error: "Preencha corretamente ano, ordem, nome e datas do período." }, { status: 400 });
  }

  if (endDate < startDate) {
    return NextResponse.json({ error: "A data final não pode ser anterior à data inicial." }, { status: 400 });
  }

  const duplicate = await prisma.academicPeriod.findUnique({
    where: {
      schoolId_schoolYear_order: {
        schoolId: session.schoolId,
        schoolYear,
        order,
      },
    },
  });

  if (duplicate) {
    return NextResponse.json({ error: "Já existe um período com esta ordem no ano letivo." }, { status: 409 });
  }

  const period = await prisma.academicPeriod.create({
    data: {
      schoolId: session.schoolId,
      schoolYear,
      order,
      name,
      startDate,
      endDate,
      status: body?.status === "ACTIVE" || body?.status === "CLOSED" ? body.status : "PLANNED",
    },
  });

  return NextResponse.json({ period }, { status: 201 });
}
