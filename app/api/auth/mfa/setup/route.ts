import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createMfaQrDataUrl,
  createOtpAuthUri,
  encryptMfaSecret,
  generateMfaSecret,
  verifyMfaChallenge,
} from "@/lib/mfa";
import { recordUserSecurityEvent } from "@/lib/security-events";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const challengeToken =
    typeof body?.challengeToken === "string"
      ? body.challengeToken
      : "";

  try {
    const challenge = await verifyMfaChallenge(challengeToken);

    if (challenge.actor !== "USER" || challenge.mode !== "SETUP") {
      return NextResponse.json(
        { error: "Desafio de configuração MFA inválido." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        id: challenge.actorId,
        active: true,
      },
      include: { school: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 },
      );
    }

    const secret = generateMfaSecret();
    const encrypted = encryptMfaSecret(secret);
    const uri = createOtpAuthUri({
      email: user.email,
      secret,
      issuer: "Minha Escola - " + user.school.name,
    });
    const qrDataUrl = await createMfaQrDataUrl(uri);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecretEncrypted: encrypted,
        mfaEnabled: false,
        mfaRecoveryCodeHashes: undefined,
        mfaEnabledAt: null,
      },
    });

    await recordUserSecurityEvent({
      schoolId: user.schoolId,
      userId: user.id,
      eventType: "MFA_SETUP_STARTED",
      request,
    }).catch(() => null);

    return NextResponse.json({
      email: user.email,
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
