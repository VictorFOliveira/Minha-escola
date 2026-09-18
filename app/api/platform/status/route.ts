import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platform-session";
import { getSystemStatus } from "@/lib/system-status";

export async function GET() {
  const session = await getPlatformSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  return NextResponse.json({
    status: await getSystemStatus(),
  });
}
