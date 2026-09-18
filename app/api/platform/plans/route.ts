import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-session";
import { auditPlatformAction } from "@/lib/audit";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const plans = await prisma.saaSPlan.findMany({
    orderBy: [{ active: "desc" }, { monthlyPrice: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });

  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code =
    typeof body?.code === "string"
      ? body.code.trim().toUpperCase()
      : "";
  const name =
    typeof body?.name === "string" ? body.name.trim() : "";
  const monthlyPrice = Number(body?.monthlyPrice);
  const annualPrice =
    body?.annualPrice === "" || body?.annualPrice === null
      ? null
      : Number(body?.annualPrice);
  const maxStudents =
    body?.maxStudents === "" || body?.maxStudents === null
      ? null
      : Number(body?.maxStudents);
  const maxUsers =
    body?.maxUsers === "" || body?.maxUsers === null
      ? null
      : Number(body?.maxUsers);

  if (
    !code ||
    !name ||
    monthlyPrice < 0 ||
    Number.isNaN(monthlyPrice) ||
    (annualPrice !== null &&
      (annualPrice < 0 || Number.isNaN(annualPrice))) ||
    (maxStudents !== null &&
      (!Number.isInteger(maxStudents) || maxStudents < 1)) ||
    (maxUsers !== null &&
      (!Number.isInteger(maxUsers) || maxUsers < 1))
  ) {
    return NextResponse.json(
      { error: "Dados do plano inválidos." },
      { status: 400 },
    );
  }

  const plan = await prisma.saaSPlan.create({
    data: {
      code,
      name,
      description:
        typeof body?.description === "string"
          ? body.description.trim() || null
          : null,
      monthlyPrice,
      annualPrice,
      maxStudents,
      maxUsers,
      features:
        body?.features && typeof body.features === "object"
          ? body.features
          : undefined,
    },
  });

  await auditPlatformAction({
    platformAdminId: session.id,
    action: "PLAN_CREATE",
    entityType: "SaaSPlan",
    entityId: plan.id,
    metadata: { code: plan.code, name: plan.name },
  }).catch(() => null);

  return NextResponse.json({ plan }, { status: 201 });
}
