import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const readRoles = ["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!readRoles.includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const schoolYear = Number(url.searchParams.get("schoolYear"));

  if (!Number.isInteger(schoolYear)) {
    return NextResponse.json({ error: "Ano letivo inválido." }, { status: 400 });
  }

  const policy = await prisma.academicPolicy.findUnique({
    where: {
      schoolId_schoolYear: {
        schoolId: session.schoolId,
        schoolYear,
      },
    },
  });

  return NextResponse.json({
    policy: policy || {
      schoolId: session.schoolId,
      schoolYear,
      passingAverage: 6,
      minimumAttendance: 75,
      recoveryEnabled: true,
      recoveryMode: "REPLACE_IF_HIGHER",
    },
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const schoolYear = Number(body?.schoolYear);
  const passingAverage = Number(body?.passingAverage);
  const minimumAttendance = Number(body?.minimumAttendance);
  const recoveryEnabled = body?.recoveryEnabled !== false;
  const recoveryMode = [
    "REPLACE_IF_HIGHER",
    "AVERAGE_WITH_ANNUAL",
    "MANUAL",
  ].includes(body?.recoveryMode)
    ? body.recoveryMode
    : "REPLACE_IF_HIGHER";

  if (
    !Number.isInteger(schoolYear) ||
    schoolYear < 2000 ||
    schoolYear > 2100 ||
    !(passingAverage >= 0 && passingAverage <= 10) ||
    !(minimumAttendance >= 0 && minimumAttendance <= 100)
  ) {
    return NextResponse.json(
      { error: "Ano, média mínima ou frequência mínima inválidos." },
      { status: 400 },
    );
  }

  const policy = await prisma.academicPolicy.upsert({
    where: {
      schoolId_schoolYear: {
        schoolId: session.schoolId,
        schoolYear,
      },
    },
    update: {
      passingAverage,
      minimumAttendance,
      recoveryEnabled,
      recoveryMode,
    },
    create: {
      schoolId: session.schoolId,
      schoolYear,
      passingAverage,
      minimumAttendance,
      recoveryEnabled,
      recoveryMode,
    },
  });

  return NextResponse.json({ policy });
}
