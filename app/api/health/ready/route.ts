import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      service: "minha-escola",
      status: "ready",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        service: "minha-escola",
        status: "not-ready",
        database: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
