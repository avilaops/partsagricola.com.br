"use server";

import { ApiClientError, createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createListing(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/painel/anuncios/novo");
  const client = createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
  const session = await client.session(token);
  const sellerId = session.seller_ids[0];
  if (!sellerId) redirect("/cadastro");
  const price = String(formData.get("price") ?? "").replace(",", ".");
  const priceOnRequest = formData.get("priceOnRequest") === "on";
  try {
    const result = await client.createListing(token, sellerId, {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      condition: String(formData.get("condition") ?? "NEW") as "NEW",
      stateCode: String(formData.get("stateCode") ?? ""),
      city: String(formData.get("city") ?? ""),
      priceOnRequest,
      ...(!priceOnRequest && price
        ? { priceAmountMinor: Math.round(Number(price) * 100) }
        : {}),
      imageUrls: formData.getAll("imageUrls").map(String).filter(Boolean),
    });
    redirect(`/painel/anuncios?created=${result.id}`);
  } catch (error) {
    if (error instanceof ApiClientError)
      redirect(`/painel/anuncios/novo?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
}
