"use server";

import { ApiClientError, createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function updateProfile(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/painel/perfil");
  const client = createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
  const sellerId = (await client.session(token)).seller_ids[0];
  if (!sellerId) redirect("/cadastro");
  try {
    await client.updateSellerProfile(token, sellerId, {
      tradeName: String(formData.get("tradeName") ?? ""),
      email: String(formData.get("email") ?? ""),
      ...(formData.get("phone")
        ? { phone: String(formData.get("phone")) }
        : {}),
      ...(formData.get("description")
        ? { description: String(formData.get("description")) }
        : {}),
      ...(formData.get("website")
        ? { website: String(formData.get("website")) }
        : {}),
      city: String(formData.get("city") ?? ""),
      stateCode: String(formData.get("stateCode") ?? ""),
    });
    redirect("/painel/perfil?saved=1");
  } catch (error) {
    if (error instanceof ApiClientError)
      redirect(`/painel/perfil?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
}
