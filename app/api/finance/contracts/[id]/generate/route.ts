import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notifyBillingSchedule } from "@/lib/system-communications";
import {
  addMonthsPreservingDay,
  calculateDiscount,
  roundMoney,
} from "@/lib/finance";
import {
  idempotencyHash,
  readIdempotency,
  saveIdempotency,
} from "@/lib/idempotency";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const operation = "billing.generate:" + id;
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

  const keyHash = idempotencyHash(
    request,
    session.schoolId,
    operation,
  );
  const contract = await prisma.billingContract.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
      status: "ACTIVE",
    },
    include: {
      enrollment: { include: { student: true } },
      guardian: true,
      benefits: { where: { active: true } },
      charges: true,
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contrato ativo não encontrado." }, { status: 404 });
  }

  if (!contract.guardian) {
    return NextResponse.json(
      { error: "O contrato precisa possuir um responsável financeiro." },
      { status: 409 },
    );
  }

  const existingNumbers = new Set(
    contract.charges
      .map((charge) => charge.installmentNumber)
      .filter((value): value is number => value !== null),
  );

  const baseAmount = Number(contract.installmentAmount);
  const createData = [];

  for (let index = 0; index < contract.installments; index += 1) {
    const installmentNumber = index + 1;
    if (existingNumbers.has(installmentNumber)) continue;

    const dueDate = addMonthsPreservingDay(
      contract.firstDueDate,
      index,
      contract.dueDay,
    );
    const discountAmount = calculateDiscount(
      baseAmount,
      dueDate,
      contract.benefits.map((benefit) => ({
        active: benefit.active,
        valueType: benefit.valueType,
        value: Number(benefit.value),
        startsAt: benefit.startsAt,
        endsAt: benefit.endsAt,
      })),
    );

    createData.push({
      schoolId: session.schoolId,
      studentId: contract.enrollment.studentId,
      enrollmentId: contract.enrollmentId,
      guardianId: contract.guardianId,
      contractId: contract.id,
      installmentNumber,
      description:
        "Mensalidade " +
        installmentNumber +
        "/" +
        contract.installments +
        " - " +
        contract.enrollment.student.name,
      baseAmount,
      discountAmount,
      amount: roundMoney(baseAmount - discountAmount),
      dueDate,
      provider: "MANUAL" as const,
    });
  }

  let createdCount = 0;
  if (createData.length) {
    const created = await prisma.charge.createMany({
      data: createData,
      skipDuplicates: true,
    });
    createdCount = created.count;
  }

  const charges = await prisma.charge.findMany({
    where: { contractId: contract.id },
    orderBy: { installmentNumber: "asc" },
  });

  if (createdCount > 0) {
    await notifyBillingSchedule({ session, contractId: contract.id }).catch(() => null);
  }

  const responseBody = {
    created: createdCount,
    charges,
  };

  await saveIdempotency({
    schoolId: session.schoolId,
    operation,
    keyHash,
    responseStatus: 200,
    responseBody,
    resourceId: contract.id,
  }).catch(() => null);

  return NextResponse.json(responseBody);
}
