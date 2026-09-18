import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { homePathForRole } from "@/lib/permissions";
import {
  consumeRecoveryCode,
  decryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyMfaChallenge,
  verifyMfaCode,
} from "@/lib/mfa";
import { createSession } from "@/lib/session";
import { auditUserAction } from "@/lib/audit";
import { recordUserSecurityEvent } from "@/lib/security-events";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const challengeToken =
    typeof body?.challengeToken === "string"
      ? body.challengeToken
      : "";
  const code =
    typeof body?.code === "string" ? body.code.trim() : "";

  if (!challengeToken || !code) {
    return NextResponse.json(
      { error: "Informe o código do autenticador ou recuperação." },
      { status: 400 },
    );
  }

  try {
    const challenge = await verifyMfaChallenge(challengeToken);

    if (challenge.actor !== "USER") {
      return NextResponse.json(
        { error: "Desafio MFA inválido." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        id: challenge.actorId,
        active: true,
      },
      include: {
        school: true,
        enrollment: { include: { class: true } },
      },
    });

    if (!user?.mfaSecretEncrypted) {
      return NextResponse.json(
        { error: "MFA ainda não foi configurado." },
        { status: 409 },
      );
    }

    const secret = decryptMfaSecret(user.mfaSecretEncrypted);
    let valid = verifyMfaCode(secret, code);
    let remainingRecoveryCodes: unknown = user.mfaRecoveryCodeHashes;
    let usedRecoveryCode = false;

    if (!valid && challenge.mode === "VERIFY") {
      const remaining = consumeRecoveryCode(
        user.mfaRecoveryCodeHashes,
        code,
      );

      if (remaining) {
        valid = true;
        usedRecoveryCode = true;
        remainingRecoveryCodes = remaining;
      }
    }

    if (!valid) {
      await recordUserSecurityEvent({
        schoolId: user.schoolId,
        userId: user.id,
        eventType: "MFA_VERIFY_FAILED",
        severity: "WARN",
        request,
      }).catch(() => null);

      return NextResponse.json(
        { error: "Código MFA inválido." },
        { status: 401 },
      );
    }

    let recoveryCodes: string[] | undefined;

    if (challenge.mode === "SETUP") {
      recoveryCodes = generateRecoveryCodes();

      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaEnabledAt: new Date(),
          mfaRecoveryCodeHashes: hashRecoveryCodes(recoveryCodes),
          lastLoginAt: new Date(),
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          ...(usedRecoveryCode
            ? { mfaRecoveryCodeHashes: remainingRecoveryCodes as string[] }
            : {}),
        },
      });
    }

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

    await Promise.all([
      auditUserAction({
        schoolId: user.schoolId,
        userId: user.id,
        action: challenge.mode === "SETUP" ? "MFA_ENABLE" : "LOGIN_MFA",
        entityType: "User",
        entityId: user.id,
      }).catch(() => null),
      recordUserSecurityEvent({
        schoolId: user.schoolId,
        userId: user.id,
        eventType:
          challenge.mode === "SETUP"
            ? "MFA_ENABLED"
            : usedRecoveryCode
              ? "MFA_RECOVERY_CODE_USED"
              : "MFA_VERIFY_SUCCESS",
        request,
      }).catch(() => null),
    ]);

    return NextResponse.json({
      ok: true,
      recoveryCodes,
      homePath:
        user.role === "ADMIN" && !user.school.onboardingCompletedAt
          ? "/dashboard/onboarding"
          : homePathForRole(user.role),
    });
  } catch {
    return NextResponse.json(
      { error: "Desafio MFA inválido ou expirado." },
      { status: 400 },
    );
  }
}
