"use server";

import { createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function client() {
  return createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
}

export async function saveFavorite(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/conta/favoritos");
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect(`/auth/login?next=${encodeURIComponent(returnTo)}`);
  await client().addFavorite(token, listingId);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=1`);
}

export async function removeFavorite(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/conta/favoritos");
  await client().removeFavorite(token, String(formData.get("listingId") ?? ""));
  redirect("/conta/favoritos?removed=1");
}
