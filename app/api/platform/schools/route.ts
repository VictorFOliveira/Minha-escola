import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-session";
import { auditPlatformAction } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const schools = await prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: {
        include: { plan: true },
      },
      _count: {
        select: {
          students: true,
          users: true,
          classes: true,
        },
      },
    },
  });

  return NextResponse.json({ schools });
}


function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = normalizeSlug(
    typeof body?.slug === "string" && body.slug.trim()
      ? body.slug
      : name,
  );
  const adminName =
    typeof body?.adminName === "string" ? body.adminName.trim() : "";
  const adminEmail =
    typeof body?.adminEmail === "string"
      ? body.adminEmail.trim().toLowerCase()
      : "";
  const adminPassword =
    typeof body?.adminPassword === "string" ? body.adminPassword : "";
  const planId =
    typeof body?.planId === "string" && body.planId
      ? body.planId
      : null;

  if (
    !name ||
    slug.length < 3 ||
    !adminName ||
    !adminEmail ||
    adminPassword.length < 10
  ) {
    return NextResponse.json(
      {
        error:
          "Informe escola, identificador, administrador, e-mail e senha inicial com pelo menos 10 caracteres.",
      },
      { status: 400 },
    );
  }

  const [slugOwner, emailOwner, plan] = await Promise.all([
    prisma.school.findUnique({ where: { slug } }),
    prisma.user.findUnique({ where: { email: adminEmail } }),
    planId
      ? prisma.saaSPlan.findFirst({
          where: { id: planId, active: true },
        })
      : Promise.resolve(null),
  ]);

  if (slugOwner) {
    return NextResponse.json(
      { error: "O identificador do tenant já está em uso." },
      { status: 409 },
    );
  }

  if (emailOwner) {
    return NextResponse.json(
      { error: "Já existe usuário com este e-mail." },
      { status: 409 },
    );
  }

  if (planId && !plan) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const created = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name,
        slug,
        lifecycleStatus: "ONBOARDING",
        document:
          typeof body?.document === "string" && body.document.trim()
            ? body.document.trim()
            : null,
      },
    });

    const admin = await tx.user.create({
      data: {
        schoolId: school.id,
        name: adminName,
        email: adminEmail,
        password: passwordHash,
        role: "ADMIN",
      },
    });

    if (plan) {
      await tx.schoolSubscription.create({
        data: {
          schoolId: school.id,
          planId: plan.id,
          status: "TRIAL",
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
        },
      });
    }

    return { school, admin };
  });

  await auditPlatformAction({
    platformAdminId: session.id,
    schoolId: created.school.id,
    action: "SCHOOL_CREATE",
    entityType: "School",
    entityId: created.school.id,
    metadata: {
      slug,
      adminEmail,
      planId,
    },
  }).catch(() => null);

  return NextResponse.json(created, { status: 201 });
}
