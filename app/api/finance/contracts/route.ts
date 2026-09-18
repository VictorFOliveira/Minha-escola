import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { paginationFromRequest, paginationMeta } from "@/lib/pagination";

const roles = ["ADMIN", "FINANCE"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!roles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

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
            {
              enrollment: {
                student: {
                  name: {
                    contains: pagination.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
            {
              guardian: {
                name: {
                  contains: pagination.search,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  };

  const [contracts, total] = await Promise.all([
    prisma.billingContract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        enrollment: {
          include: {
            student: true,
            class: true,
          },
        },
        guardian: true,
        billingPlan: true,
        benefits: { where: { active: true } },
        _count: { select: { charges: true } },
      },
    }),
    prisma.billingContract.count({ where }),
  ]);

  return NextResponse.json({
    contracts,
    meta: paginationMeta(total, pagination.page, pagination.pageSize),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!roles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const enrollmentId =
    typeof body?.enrollmentId === "string" ? body.enrollmentId : "";
  const billingPlanId =
    typeof body?.billingPlanId === "string" && body.billingPlanId
      ? body.billingPlanId
      : null;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      class: { schoolId: session.schoolId },
      status: { in: ["ACTIVE", "PENDING"] },
    },
    include: {
      student: {
        include: {
          guardians: {
            where: { financialResponsible: true },
            include: { guardian: true },
          },
        },
      },
      class: true,
      billingContract: true,
    },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Matrícula inválida." }, { status: 404 });
  }

  if (enrollment.billingContract) {
    return NextResponse.json(
      { error: "Esta matrícula já possui contrato financeiro." },
      { status: 409 },
    );
  }

  const financialGuardian = enrollment.student.guardians.find(
    (link) => link.guardian.status === "ACTIVE",
  )?.guardian;

  if (!financialGuardian) {
    return NextResponse.json(
      { error: "A matrícula precisa ter um responsável financeiro ativo." },
      { status: 409 },
    );
  }

  const plan = billingPlanId
    ? await prisma.billingPlan.findFirst({
        where: {
          id: billingPlanId,
          schoolId: session.schoolId,
          active: true,
          schoolYear: enrollment.class.schoolYear,
        },
      })
    : null;

  if (billingPlanId && !plan) {
    return NextResponse.json(
      { error: "Plano financeiro incompatível com o ano letivo." },
      { status: 400 },
    );
  }

  const installmentAmount = Number(
    body?.installmentAmount ?? plan?.installmentAmount,
  );
  const installments = Number(body?.installments ?? plan?.installments);
  const dueDay = Number(body?.dueDay ?? plan?.dueDay);
  const firstDueDate = body?.firstDueDate
    ? new Date(String(body.firstDueDate) + "T12:00:00.000Z")
    : null;

  if (
    !(installmentAmount > 0) ||
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > 24 ||
    !Number.isInteger(dueDay) ||
    dueDay < 1 ||
    dueDay > 31 ||
    !firstDueDate ||
    Number.isNaN(firstDueDate.getTime())
  ) {
    return NextResponse.json(
      { error: "Valor, parcelas, vencimento e primeira data são obrigatórios." },
      { status: 400 },
    );
  }

  const contract = await prisma.billingContract.create({
    data: {
      schoolId: session.schoolId,
      enrollmentId,
      guardianId: financialGuardian.id,
      billingPlanId: plan?.id || null,
      installmentAmount,
      installments,
      dueDay,
      firstDueDate,
    },
    include: {
      enrollment: { include: { student: true, class: true } },
      guardian: true,
      billingPlan: true,
      benefits: true,
    },
  });

  return NextResponse.json({ contract }, { status: 201 });
}
