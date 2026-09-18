import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "minha-escola",
    status: "ok",
    version: "0.1.0",
  });
}
