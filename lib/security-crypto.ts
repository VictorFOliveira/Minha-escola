import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey() {
  const secret =
    process.env.MFA_ENCRYPTION_KEY ||
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET;

  if (!secret || (process.env.NODE_ENV === "production" && secret.length < 32)) {
    throw new Error(
      "MFA_ENCRYPTION_KEY/INTEGRATION_ENCRYPTION_KEY/AUTH_SECRET precisa ter 32+ caracteres.",
    );
  }

  return createHash("sha256")
    .update(secret || "minha-escola-dev-encryption-key")
    .digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string) {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] =
    value.split(".");

  if (
    version !== "v1" ||
    !ivEncoded ||
    !tagEncoded ||
    !encryptedEncoded
  ) {
    throw new Error("Segredo criptografado inválido.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivEncoded, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashSecret(value: string) {
  const pepper =
    process.env.SECURITY_PEPPER ||
    process.env.AUTH_SECRET ||
    "minha-escola-dev-pepper";

  return createHash("sha256")
    .update(value + ":" + pepper)
    .digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
