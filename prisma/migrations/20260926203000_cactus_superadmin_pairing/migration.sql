CREATE TABLE IF NOT EXISTS "platform_control_plane_credentials" (
  "id" INTEGER NOT NULL,
  "key_hash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "paired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotated_at" TIMESTAMP(3),
  CONSTRAINT "platform_control_plane_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_control_plane_credentials_singleton" CHECK ("id" = 1)
);
