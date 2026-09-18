import { randomBytes, timingSafeEqual } from "node:crypto";
import { authenticator } from "@otplib/v12-adapter";
import QRCode from "qrcode";
import { SignJWT, jwtVerify } from "jose";
import {
  decryptSecret,
  encryptSecret,
  hashSecret,
} from "@/lib/security-crypto";

type MfaActor = "USER" | "PLATFORM_ADMIN";
type MfaMode = "SETUP" | "VERIFY";

function challengeSecret() {
  const secret =
    process.env.MFA_CHALLENGE_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.PLATFORM_AUTH_SECRET;

  if (!secret || (process.env.NODE_ENV === "production" && secret.length < 32)) {
    throw new Error("MFA_CHALLENGE_SECRET deve possuir 32+ caracteres.");
  }

  return new TextEncoder().encode(
    secret || "minha-escola-dev-mfa-challenge-secret",
  );
}

export async function createMfaChallenge(input: {
  actor: MfaActor;
  actorId: string;
  mode: MfaMode;
}) {
  return new SignJWT({
    actor: input.actor,
    mode: input.mode,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.actorId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(challengeSecret());
}

export async function verifyMfaChallenge(token: string) {
  const { payload } = await jwtVerify(token, challengeSecret());

  if (
    typeof payload.sub !== "string" ||
    (payload.actor !== "USER" && payload.actor !== "PLATFORM_ADMIN") ||
    (payload.mode !== "SETUP" && payload.mode !== "VERIFY")
  ) {
    throw new Error("Desafio MFA inválido.");
  }

  return {
    actor: payload.actor as MfaActor,
    actorId: payload.sub,
    mode: payload.mode as MfaMode,
  };
}

export function generateMfaSecret() {
  return authenticator.generateSecret();
}

export function encryptMfaSecret(secret: string) {
  return encryptSecret(secret);
}

export function decryptMfaSecret(secret: string) {
  return decryptSecret(secret);
}

export function verifyMfaCode(secret: string, code: string) {
  return authenticator.verify({
    token: code.replace(/\s+/g, ""),
    secret,
  });
}

export function createOtpAuthUri(input: {
  email: string;
  secret: string;
  issuer?: string;
}) {
  return authenticator.keyuri(
    input.email,
    input.issuer || "Minha Escola",
    input.secret,
  );
}

export async function createMfaQrDataUrl(uri: string) {
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 260,
  });
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(8).toString("hex").toUpperCase();
    return raw.slice(0, 4) + "-" + raw.slice(4, 8) + "-" + raw.slice(8, 12);
  });
}

export function hashRecoveryCodes(codes: string[]) {
  return codes.map((code) => hashSecret("recovery:" + normalizeRecoveryCode(code)));
}

function normalizeRecoveryCode(code: string) {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function consumeRecoveryCode(
  hashes: unknown,
  candidate: string,
) {
  if (!Array.isArray(hashes)) return null;

  const candidateHash = hashSecret(
    "recovery:" + normalizeRecoveryCode(candidate),
  );

  const index = hashes.findIndex((value) => {
    if (typeof value !== "string") return false;
    const a = Buffer.from(value);
    const b = Buffer.from(candidateHash);
    return a.length === b.length && timingSafeEqual(a, b);
  });

  if (index < 0) return null;

  return hashes.filter((_, currentIndex) => currentIndex !== index);
}
