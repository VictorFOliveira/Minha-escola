import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { homePathForRole, isAppRole } from "@/lib/permissions";
import { auditUserAction } from "@/lib/audit";
import {
  checkRateLimit,
  clearRateLimit,
  requestFingerprint,
} from "@/lib/rate-limit";
import { createMfaChallenge } from "@/lib/mfa";
import { recordUserSecurityEvent } from "@/lib/security-events";
import { assertRequestSchoolHost } from "@/lib/tenant-domain";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  const fingerprint = requestFingerprint(request);
  const [ipThrottle, accountThrottle] = await Promise.all([
    checkRateLimit({
      action: "LOGIN_IP",
      key: fingerprint,
      limit: 20,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
    }),
    checkRateLimit({
      action: "LOGIN_ACCOUNT",
      key: email,
      limit: 10,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
    }),
  ]);

  if (!ipThrottle.allowed || !accountThrottle.allowed) {
    const retryAfter = Math.max(
      ipThrottle.retryAfterSeconds,
      accountThrottle.retryAfterSeconds,
    );
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      school: {
        include: {
          subscription: true,
        },
      },
      enrollment: {
        include: {
          class: true,
          student: true,
        },
      },
    },
  });

  if (!user || !user.active || !isAppRole(user.role)) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  if (!(await assertRequestSchoolHost(request, user.schoolId))) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  if (
    ["SUSPENDED", "CANCELLED"].includes(user.school.lifecycleStatus) ||
    ["SUSPENDED", "CANCELLED"].includes(
      user.school.subscription?.status || "",
    )
  ) {
    return NextResponse.json(
      { error: "O acesso desta instituição está suspenso. Contate o suporte da plataforma." },
      { status: 403 },
    );
  }

  if (
    user.school.lifecycleStatus === "ONBOARDING" &&
    user.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { error: "A instituição ainda está concluindo a implantação." },
      { status: 403 },
    );
  }

  if (
    user.role === "STUDENT" &&
    (
      !user.enrollment ||
      user.enrollment.class.schoolId !== user.schoolId ||
      !["ACTIVE", "PENDING"].includes(user.enrollment.status)
    )
  ) {
    return NextResponse.json(
      { error: "A conta do aluno não está vinculada a uma matrícula válida." },
      { status: 403 },
    );
  }

  if (user.role === "GUARDIAN" && !user.guardianId) {
    return NextResponse.json(
      { error: "A conta do responsável ainda não está vinculada a um cadastro." },
      { status: 403 },
    );
  }

  if (user.role === "TEACHER" && !user.teacherId) {
    return NextResponse.json(
      { error: "A conta do professor ainda não está vinculada ao cadastro docente." },
      { status: 403 },
    );
  }

  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword) {
    await recordUserSecurityEvent({
      schoolId: user.schoolId,
      userId: user.id,
      eventType: "LOGIN_FAILED",
      severity: "WARN",
      request,
    }).catch(() => null);

    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  await clearRateLimit("LOGIN_ACCOUNT", email);

  const mfaMode =
    user.mfaEnabled
      ? "VERIFY"
      : user.role === "ADMIN"
        ? "SETUP"
        : null;

  if (mfaMode) {
    const challengeToken = await createMfaChallenge({
      actor: "USER",
      actorId: user.id,
      mode: mfaMode,
    });

    await recordUserSecurityEvent({
      schoolId: user.schoolId,
      userId: user.id,
      eventType:
        mfaMode === "SETUP"
          ? "MFA_ENROLLMENT_REQUIRED"
          : "MFA_CHALLENGE_REQUIRED",
      request,
    }).catch(() => null);

    return NextResponse.json({
      mfaRequired: true,
      mfaMode,
      challengeToken,
    });
  }

  await Promise.all([
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    auditUserAction({
      schoolId: user.schoolId,
      userId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
    }).catch(() => null),
    recordUserSecurityEvent({
      schoolId: user.schoolId,
      userId: user.id,
      eventType: "LOGIN_SUCCESS",
      request,
    }).catch(() => null),
  ]);

  await createSession(
    {
      id: user.id,
      schoolId: user.schoolId,
      schoolName: user.school.name,
      name: user.name,
      email: user.email,
      role: user.role,
      enrollmentId: user.enrollmentId,
      guardianId: user.guardianId,
      teacherId: user.teacherId,
    },
    { request, mfaVerified: true },
  );

  return NextResponse.json({
    homePath:
      user.role === "ADMIN" && !user.school.onboardingCompletedAt
        ? "/dashboard/onboarding"
        : homePathForRole(user.role),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolName: user.school.name,
    },
  });
}
