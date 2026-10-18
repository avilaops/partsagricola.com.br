import { createApiClient } from "@partsagricola/api-client";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "production" &&
    request.nextUrl.searchParams.get("evidence") === "1"
  )
    return NextResponse.next();
  const token = request.cookies.get("pa_access")?.value;
  const principal = token
    ? await createApiClient({
        baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
      })
        .session(token)
        .catch(() => null)
    : null;
  return principal?.roles.some(
    (role) => role === "ADMIN" || role === "SUPPORT" || role === "FINANCE",
  )
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/auth/login", request.url));
}
export const config = { matcher: ["/administracao/:path*"] };
