"use server";

import { ApiClientError, createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createPartRequest(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/conta/solicitacoes/nova");
  try {
    const result = await createApiClient({
      baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
    }).createPartRequest(token, {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      ...(formData.get("categoryId")
        ? { categoryId: String(formData.get("categoryId")) }
        : {}),
      ...(formData.get("brandId")
        ? { brandId: String(formData.get("brandId")) }
        : {}),
    });
    redirect(`/conta/solicitacoes/nova?created=${result.id}`);
  } catch (error) {
    if (error instanceof ApiClientError)
      redirect(
        `/conta/solicitacoes/nova?error=${encodeURIComponent(error.code)}`,
      );
    throw error;
  }
}
