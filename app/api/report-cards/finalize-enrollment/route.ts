import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { recomputeEnrollmentStatus } from "@/lib/report-card";
import { notifyReportClosed } from "@/lib/system-communications";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const enrollmentId =
    typeof body?.enrollmentId === "string" ? body.enrollmentId : "";
  const decisionNote =
    typeof body?.decisionNote === "string" && body.decisionNote.trim()
      ? body.decisionNote.trim()
      : null;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      class: { schoolId: session.schoolId },
    },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Matrícula não encontrada." }, { status: 404 });
  }

  const calculated = await recomputeEnrollmentStatus(enrollmentId);

  if (!calculated || calculated.status === "IN_PROGRESS") {
    return NextResponse.json(
      {
        error:
          "Ainda existem disciplinas em andamento ou recuperação pendente. Resolva-as antes de fechar o resultado da matrícula.",
      },
      { status: 409 },
    );
  }

  const academicResult = await prisma.enrollmentAcademicResult.upsert({
    where: { enrollmentId },
    update: {
      status: calculated.status,
      decisionNote,
      closedAt: new Date(),
      closedByUserId: session.id,
    },
    create: {
      enrollmentId,
      status: calculated.status,
      decisionNote,
      closedAt: new Date(),
      closedByUserId: session.id,
    },
  });

  await notifyReportClosed({ session, enrollmentId }).catch(() => null);

  return NextResponse.json({ academicResult });
}
