import { NextRequest, NextResponse } from "next/server";

function requestId(request: NextRequest) {
  const incoming = request.headers.get("x-request-id")?.trim();

  if (incoming && /^[A-Za-z0-9._:-]{8,100}$/.test(incoming)) {
    return incoming;
  }

  return crypto.randomUUID();
}

export function middleware(request: NextRequest) {
  const id = requestId(request);
  const headers = new Headers(request.headers);
  headers.set("x-request-id", id);

  const response = NextResponse.next({
    request: { headers },
  });

  response.headers.set("x-request-id", id);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
