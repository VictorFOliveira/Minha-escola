import { NextResponse } from "next/server";
import { students } from "@/lib/mock-data";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  return NextResponse.json({
    data: students,
    meta: {
      source: "demo",
      total: students.length,
    },
  });
}
