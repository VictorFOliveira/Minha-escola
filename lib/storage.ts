import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function getStorageConfig() {
  const endpoint = process.env.STORAGE_ENDPOINT?.trim();
  const region = process.env.STORAGE_REGION?.trim() || "auto";
  const bucket = process.env.STORAGE_BUCKET?.trim();
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Storage S3/R2 não configurado.");
  }

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  };
}

function client() {
  const config = getStorageConfig();

  return {
    config,
    s3: new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
}

function safeName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-100);

  return normalized || "arquivo";
}

export function validateUpload(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  if (!input.originalName.trim()) {
    throw new Error("Nome do arquivo inválido.");
  }

  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new Error("Tipo de arquivo não permitido.");
  }

  if (
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MAX_FILE_SIZE
  ) {
    throw new Error("Arquivo deve possuir no máximo 10 MB.");
  }
}

export function buildObjectKey(
  schoolId: string,
  originalName: string,
) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return [
    "schools",
    schoolId,
    String(year),
    month,
    randomUUID() + "-" + safeName(originalName),
  ].join("/");
}

export async function createPresignedUpload(input: {
  objectKey: string;
  mimeType: string;
}) {
  const { config, s3 } = client();

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ContentType: input.mimeType,
  });

  return getSignedUrl(s3, command, {
    expiresIn: 10 * 60,
    signableHeaders: new Set(["content-type"]),
  });
}

export async function headStoredObject(objectKey: string) {
  const { config, s3 } = client();

  return s3.send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
  );
}

export async function createPresignedDownload(
  objectKey: string,
  originalName: string,
) {
  const { config, s3 } = client();

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ResponseContentDisposition:
      'attachment; filename="' +
      safeName(originalName).replaceAll('"', "") +
      '"',
  });

  return getSignedUrl(s3, command, {
    expiresIn: 5 * 60,
  });
}

export async function deleteStoredObject(objectKey: string) {
  const { config, s3 } = client();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
  );
}

export function storageConfigured() {
  return Boolean(
    process.env.STORAGE_ENDPOINT?.trim() &&
      process.env.STORAGE_BUCKET?.trim() &&
      process.env.STORAGE_ACCESS_KEY_ID?.trim() &&
      process.env.STORAGE_SECRET_ACCESS_KEY?.trim(),
  );
}
