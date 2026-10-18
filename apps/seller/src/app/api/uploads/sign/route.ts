import { ApiClientError, createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token)
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      fileName: string;
      contentType: "image/jpeg" | "image/png" | "image/webp";
      size: number;
    };
    const client = createApiClient({
      baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
    });
    const sellerId = (await client.session(token)).seller_ids[0];
    if (!sellerId)
      return NextResponse.json({ error: "SELLER_REQUIRED" }, { status: 403 });
    const signed = await client.signUpload(token, sellerId, body);
    const publicOrigin = process.env.ASSET_PUBLIC_ORIGIN?.replace(/\/$/, "");
    if (!publicOrigin)
      return NextResponse.json(
        { error: "ASSET_PUBLIC_ORIGIN_MISSING" },
        { status: 503 },
      );
    return NextResponse.json({
      ...signed,
      publicUrl: `${publicOrigin}/${signed.key}`,
    });
  } catch (error) {
    const status = error instanceof ApiClientError ? error.status : 400;
    const code =
      error instanceof ApiClientError ? error.code : "INVALID_UPLOAD";
    return NextResponse.json({ error: code }, { status });
  }
}
