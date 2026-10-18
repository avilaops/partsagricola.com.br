"use server";

import { ApiClientError, createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createInterest(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/catalogo");
  try {
    await createApiClient({
      baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
    }).createInterest(
      token,
      String(formData.get("listingId") ?? ""),
      String(formData.get("message") ?? "") || undefined,
    );
    redirect("/conta/interesses?created=1");
  } catch (error) {
    if (error instanceof ApiClientError)
      redirect(`/catalogo?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
}
