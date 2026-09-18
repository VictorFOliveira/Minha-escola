import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { checkRateLimit, requestFingerprint } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Informe seu e-mail." }, { status: 400 });
  }

  const fingerprint = requestFingerprint(request);
  const [ipThrottle, accountThrottle] = await Promise.all([
    checkRateLimit({
      action: "RESET_IP",
      key: fingerprint,
      limit: 20,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }),
    checkRateLimit({
      action: "RESET_ACCOUNT",
      key: email,
      limit: 5,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }),
  ]);

  if (!ipThrottle.allowed || !accountThrottle.allowed) {
    const retryAfter = Math.max(
      ipThrottle.retryAfterSeconds,
      accountThrottle.retryAfterSeconds,
    );
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente mais tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { school: true },
  });

  if (
    !user ||
    !user.active ||
    ["SUSPENDED", "CANCELLED"].includes(user.school.lifecycleStatus)
  ) {
    return NextResponse.json({
      ok: true,
      message: "Se o e-mail existir, as instruções de recuperação serão geradas.",
    });
  }

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const reset = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  if (process.env.NODE_ENV === "production") {
    const appUrl = process.env.APP_URL?.trim();

    if (appUrl) {
      const resetUrl =
        appUrl.replace(/\/$/, "") +
        "/reset-password?token=" +
        encodeURIComponent(token);

      await sendTransactionalEmail({
        to: user.email,
        subject: "Recuperação de senha — Minha Escola",
        html:
          '<div style="font-family:Arial,sans-serif;line-height:1.6">' +
          "<h2>Recuperação de senha</h2>" +
          "<p>Recebemos uma solicitação para redefinir sua senha.</p>" +
          '<p><a href="' +
          resetUrl +
          '">Definir nova senha</a></p>' +
          "<p>O link expira em 30 minutos. Se você não solicitou a alteração, ignore esta mensagem.</p>" +
          "</div>",
        idempotencyKey: "password-reset/" + reset.id,
      }).catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Se o e-mail existir, as instruções de recuperação serão geradas.",
    ...(process.env.NODE_ENV !== "production" ? { debugToken: token } : {}),
  });
}
