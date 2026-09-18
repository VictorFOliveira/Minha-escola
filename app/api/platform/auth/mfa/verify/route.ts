import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consumeRecoveryCode,
  decryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyMfaChallenge,
  verifyMfaCode,
} from "@/lib/mfa";
import { createPlatformSession } from "@/lib/platform-session";
import { auditPlatformAction } from "@/lib/audit";
import { recordPlatformSecurityEvent } from "@/lib/security-events";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const challengeToken =
    typeof body?.challengeToken === "string"
      ? body.challengeToken
      : "";
  const code =
    typeof body?.code === "string" ? body.code.trim() : "";

  try {
    const challenge = await verifyMfaChallenge(challengeToken);

    if (challenge.actor !== "PLATFORM_ADMIN" || !code) {
      throw new Error("invalid");
    }

    const admin = await prisma.platformAdmin.findFirst({
      where: {
        id: challenge.actorId,
        active: true,
      },
    });

    if (!admin?.mfaSecretEncrypted) {
      return NextResponse.json(
        { error: "MFA ainda não foi configurado." },
        { status: 409 },
      );
    }

    const secret = decryptMfaSecret(admin.mfaSecretEncrypted);
    let valid = verifyMfaCode(secret, code);
    let remainingRecoveryCodes: unknown = admin.mfaRecoveryCodeHashes;
    let usedRecoveryCode = false;

    if (!valid && challenge.mode === "VERIFY") {
      const remaining = consumeRecoveryCode(
        admin.mfaRecoveryCodeHashes,
        code,
      );

      if (remaining) {
        valid = true;
        usedRecoveryCode = true;
        remainingRecoveryCodes = remaining;
      }
    }

    if (!valid) {
      await recordPlatformSecurityEvent({
        platformAdminId: admin.id,
        eventType: "PLATFORM_MFA_VERIFY_FAILED",
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

      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          mfaEnabled: true,
          mfaEnabledAt: new Date(),
          mfaRecoveryCodeHashes: hashRecoveryCodes(recoveryCodes),
          lastLoginAt: new Date(),
        },
      });
    } else {
      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          lastLoginAt: new Date(),
          ...(usedRecoveryCode
            ? { mfaRecoveryCodeHashes: remainingRecoveryCodes as string[] }
            : {}),
        },
      });
    }

    await createPlatformSession(
      {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
      { request, mfaVerified: true },
    );

    await Promise.all([
      auditPlatformAction({
        platformAdminId: admin.id,
        action:
          challenge.mode === "SETUP"
            ? "PLATFORM_MFA_ENABLE"
            : "PLATFORM_LOGIN_MFA",
        entityType: "PlatformAdmin",
        entityId: admin.id,
      }).catch(() => null),
      recordPlatformSecurityEvent({
        platformAdminId: admin.id,
        eventType:
          challenge.mode === "SETUP"
            ? "PLATFORM_MFA_ENABLED"
            : usedRecoveryCode
              ? "PLATFORM_MFA_RECOVERY_CODE_USED"
              : "PLATFORM_MFA_VERIFY_SUCCESS",
        request,
      }).catch(() => null),
    ]);

    return NextResponse.json({
      ok: true,
      recoveryCodes,
      homePath: "/superadmin",
    });
  } catch {
    return NextResponse.json(
      { error: "Desafio MFA inválido ou expirado." },
      { status: 400 },
    );
  }
}
