import { NextResponse } from "next/server";
import { destroyPlatformSession } from "@/lib/platform-session";

export async function POST(request: Request) {
  await destroyPlatformSession();
  return NextResponse.redirect(new URL("/superadmin/login", request.url), 303);
}
