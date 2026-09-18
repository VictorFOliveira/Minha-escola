import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;

  const classGroup = await prisma.classGroup.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
      ...(session.role === "TEACHER" && session.teacherId
        ? {
            OR: [
              { teacherId: session.teacherId },
              { classSubjects: { some: { teacherId: session.teacherId } } },
            ],
          }
        : {}),
    },
    include: {
      curriculum: true,
      classSubjects: {
        orderBy: { subject: { name: "asc" } },
        include: {
          subject: true,
          teacher: true,
          scheduleSlots: {
            orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          },
        },
      },
    },
  });

  if (!classGroup) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });

  return NextResponse.json({ class: classGroup });
}
