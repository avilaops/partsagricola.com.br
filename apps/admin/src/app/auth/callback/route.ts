import { exchangeAuthorizationCode } from "@partsagricola/shared";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const state = jar.get("pa_state")?.value;
  const verifier = jar.get("pa_verifier")?.value;
  if (
    !state ||
    state !== url.searchParams.get("state") ||
    !verifier ||
    !url.searchParams.get("code")
  )
    return NextResponse.json({ error: "invalid_callback" }, { status: 400 });
  const app = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const result = await exchangeAuthorizationCode({
    authOrigin: process.env.AUTH_ORIGIN ?? "http://localhost:4101",
    code: url.searchParams.get("code")!,
    verifier,
    clientId: process.env.OIDC_CLIENT_ID ?? "partsagricola-admin",
    redirectUri: `${app}/auth/callback`,
  });
  const response = NextResponse.redirect(app);
  response.cookies.set(
    "pa_access",
    result.access_token,
    sessionCookie(result.expires_in),
  );
  if (result.refresh_token)
    response.cookies.set(
      "pa_refresh",
      result.refresh_token,
      sessionCookie(2_592_000),
    );
  response.cookies.delete("pa_verifier");
  response.cookies.delete("pa_state");
  return response;
}
function sessionCookie(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
