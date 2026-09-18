import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createMfaQrDataUrl,
  createOtpAuthUri,
  encryptMfaSecret,
  generateMfaSecret,
  verifyMfaChallenge,
} from "@/lib/mfa";
import { recordPlatformSecurityEvent } from "@/lib/security-events";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const challengeToken =
    typeof body?.challengeToken === "string"
      ? body.challengeToken
      : "";

  try {
    const challenge = await verifyMfaChallenge(challengeToken);

    if (
      challenge.actor !== "PLATFORM_ADMIN" ||
      challenge.mode !== "SETUP"
    ) {
      return NextResponse.json(
        { error: "Desafio de configuração MFA inválido." },
        { status: 400 },
      );
    }

    const admin = await prisma.platformAdmin.findFirst({
      where: {
        id: challenge.actorId,
        active: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Superadmin não encontrado." },
        { status: 404 },
      );
    }

    const secret = generateMfaSecret();
    const encrypted = encryptMfaSecret(secret);
    const uri = createOtpAuthUri({
      email: admin.email,
      secret,
      issuer: "Minha Escola Superadmin",
    });
    const qrDataUrl = await createMfaQrDataUrl(uri);

    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        mfaSecretEncrypted: encrypted,
        mfaEnabled: false,
        mfaRecoveryCodeHashes: undefined,
        mfaEnabledAt: null,
      },
    });

    await recordPlatformSecurityEvent({
      platformAdminId: admin.id,
      eventType: "PLATFORM_MFA_SETUP_STARTED",
      request,
    }).catch(() => null);

    return NextResponse.json({
      email: admin.email,
      secret,
      otpAuthUri: uri,
      qrDataUrl,
    });
  } catch {
    return NextResponse.json(
      { error: "Desafio MFA inválido ou expirado." },
      { status: 400 },
    );
  }
}
