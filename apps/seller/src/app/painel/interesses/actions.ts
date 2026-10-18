"use server";

import { ApiClientError, createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createProposal(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/painel/interesses");
  const client = createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
  const sellerId = (await client.session(token)).seller_ids[0];
  if (!sellerId) redirect("/cadastro");
  const price = String(formData.get("amount") ?? "").replace(",", ".");
  try {
    await client.createSellerProposal(
      token,
      sellerId,
      String(formData.get("interestId") ?? ""),
      {
        terms: String(formData.get("terms") ?? ""),
        ...(price ? { amountMinor: Math.round(Number(price) * 100) } : {}),
      },
    );
    redirect("/painel/interesses?sent=1");
  } catch (error) {
    if (error instanceof ApiClientError)
      redirect(`/painel/interesses?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
}
