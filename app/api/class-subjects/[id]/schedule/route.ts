import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

type SlotInput = {
  weekday?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  room?: unknown;
};

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function PUT(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.classSubject.findFirst({
    where: { id, class: { schoolId: session.schoolId } },
  });

  if (!current) return NextResponse.json({ error: "Disciplina da turma não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.slots)) {
    return NextResponse.json({ error: "Informe a lista de horários." }, { status: 400 });
  }

  const slots: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    room: string | null;
  }> = (body.slots as SlotInput[]).map((slot) => ({
    weekday: Number(slot?.weekday),
    startTime: typeof slot?.startTime === "string" ? slot.startTime.trim() : "",
    endTime: typeof slot?.endTime === "string" ? slot.endTime.trim() : "",
    room: typeof slot?.room === "string" && slot.room.trim() ? slot.room.trim() : null,
  }));

  for (const slot of slots) {
    if (
      !Number.isInteger(slot.weekday) ||
      slot.weekday < 1 ||
      slot.weekday > 7 ||
      !validTime(slot.startTime) ||
      !validTime(slot.endTime) ||
      slot.endTime <= slot.startTime
    ) {
      return NextResponse.json({ error: "Existe um horário inválido." }, { status: 400 });
    }
  }

  const conflicting = slots.some((slot, index) =>
    slots.some(
      (other, otherIndex) =>
        index !== otherIndex &&
        slot.weekday === other.weekday &&
        slot.startTime < other.endTime &&
        other.startTime < slot.endTime,
    ),
  );

  if (conflicting) {
    return NextResponse.json({ error: "Há horários sobrepostos para esta disciplina." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.classScheduleSlot.deleteMany({ where: { classSubjectId: id } });

    if (slots.length) {
      await tx.classScheduleSlot.createMany({
        data: slots.map((slot) => ({
          classSubjectId: id,
          ...slot,
        })),
      });
    }

    return tx.classSubject.findUniqueOrThrow({
      where: { id },
      include: {
        subject: true,
        teacher: true,
        scheduleSlots: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
      },
    });
  });

  return NextResponse.json({ classSubject: result });
}
