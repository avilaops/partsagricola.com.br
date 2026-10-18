import { createApiClient } from "@partsagricola/api-client";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(request: NextRequest) {
  const token = request.cookies.get("pa_access")?.value;
  const principal = token
    ? await createApiClient({
        baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
      })
        .session(token)
        .catch(() => null)
    : null;
  return principal
    ? NextResponse.next()
    : NextResponse.redirect(
        new URL(
          `/auth/login?next=${encodeURIComponent(request.nextUrl.pathname)}`,
          request.url,
        ),
      );
}
export const config = { matcher: ["/conta/:path*"] };
