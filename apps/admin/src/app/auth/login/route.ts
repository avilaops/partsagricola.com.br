import { createOidcLogin } from "@partsagricola/shared";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const app = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const login = await createOidcLogin({
    authOrigin: process.env.AUTH_ORIGIN ?? "http://localhost:4101",
    clientId: process.env.OIDC_CLIENT_ID ?? "partsagricola-admin",
    redirectUri: `${app}/auth/callback`,
  });
  const response = NextResponse.redirect(login.url);
  response.cookies.set("pa_verifier", login.verifier, cookie());
  response.cookies.set("pa_state", login.state, cookie());
  return response;
}
function cookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
}
