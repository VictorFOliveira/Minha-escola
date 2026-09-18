import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { auditUserAction } from "@/lib/audit";

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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const school = await prisma.school.findUnique({
    where: { id: session.schoolId },
    include: {
      subscription: { include: { plan: true } },
      _count: {
        select: {
          students: true,
          users: true,
          classes: true,
        },
      },
    },
  });

  return NextResponse.json({ school });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const current = await prisma.school.findUnique({
    where: { id: session.schoolId },
  });

  if (!current) {
    return NextResponse.json({ error: "Escola não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const requestedSlug =
    typeof body?.slug === "string" && body.slug.trim()
      ? body.slug
      : name;
  const slug = normalizeSlug(requestedSlug);

  if (!name || slug.length < 3) {
    return NextResponse.json(
      { error: "Nome e identificador da escola são obrigatórios." },
      { status: 400 },
    );
  }

  const slugOwner = await prisma.school.findFirst({
    where: {
      slug,
      id: { not: session.schoolId },
    },
    select: { id: true },
  });

  if (slugOwner) {
    return NextResponse.json(
      { error: "Este identificador já está em uso por outra escola." },
      { status: 409 },
    );
  }

  const now = new Date();

  const school = await prisma.school.update({
    where: { id: session.schoolId },
    data: {
      name,
      slug,
      document:
        typeof body?.document === "string" && body.document.trim()
          ? body.document.trim()
          : null,
      email:
        typeof body?.email === "string" && body.email.trim()
          ? body.email.trim().toLowerCase()
          : null,
      phone:
        typeof body?.phone === "string" && body.phone.trim()
          ? body.phone.trim()
          : null,
      address:
        typeof body?.address === "string" && body.address.trim()
          ? body.address.trim()
          : null,
      city:
        typeof body?.city === "string" && body.city.trim()
          ? body.city.trim()
          : null,
      state:
        typeof body?.state === "string" && body.state.trim()
          ? body.state.trim().toUpperCase()
          : null,
      zipCode:
        typeof body?.zipCode === "string" && body.zipCode.trim()
          ? body.zipCode.trim()
          : null,
      onboardingCompletedAt: now,
      lifecycleStatus:
        current.lifecycleStatus === "ONBOARDING"
          ? "TRIAL"
          : current.lifecycleStatus,
    },
  });

  const subscription = await prisma.schoolSubscription.findUnique({
    where: { schoolId: session.schoolId },
  });

  if (!subscription) {
    const starter = await prisma.saaSPlan.findFirst({
      where: { code: "STARTER", active: true },
    });

    if (starter) {
      const trialEndsAt = new Date(
        now.getTime() + 14 * 24 * 60 * 60 * 1000,
      );

      await prisma.schoolSubscription.create({
        data: {
          schoolId: session.schoolId,
          planId: starter.id,
          status: "TRIAL",
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          nextBillingAt: trialEndsAt,
        },
      });
    }
  }

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "ONBOARDING_COMPLETE",
    entityType: "School",
    entityId: session.schoolId,
    metadata: { slug },
  }).catch(() => null);

  return NextResponse.json({ school });
}
