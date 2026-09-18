import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "minha-escola",
    status: "ok",
    version: process.env.APP_VERSION || "1.0.0",
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "unknown",
    timestamp: new Date().toISOString(),
  });
}
