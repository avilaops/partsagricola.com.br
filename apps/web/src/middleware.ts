import { introspectSession } from "@partsagricola/shared";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(request: NextRequest) {
  const token = request.cookies.get("pa_access")?.value;
  const principal = token
    ? await introspectSession(
        process.env.AUTH_ORIGIN ?? "http://localhost:4101",
        token,
      )
    : null;
  return principal
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/auth/login", request.url));
}
export const config = { matcher: ["/conta/:path*"] };
