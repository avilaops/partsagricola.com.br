"use server";

import { ApiClientError, createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createCompanyApplication(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/cadastro");
  try {
    const result = await createApiClient({
      baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
    }).createCompanyApplication(token, {
      cnpj: String(formData.get("cnpj") ?? ""),
      legalName: String(formData.get("legalName") ?? ""),
      tradeName: String(formData.get("tradeName") ?? ""),
      email: String(formData.get("email") ?? ""),
      ...(formData.get("phone")
        ? { phone: String(formData.get("phone")) }
        : {}),
      stateCode: String(formData.get("stateCode") ?? ""),
      city: String(formData.get("city") ?? ""),
      ...(formData.get("description")
        ? { description: String(formData.get("description")) }
        : {}),
      ...(formData.get("website")
        ? { website: String(formData.get("website")) }
        : {}),
      categoryIds: formData.getAll("categoryIds").map(String),
      serviceRegions: formData.getAll("serviceRegions").map(String),
    });
    redirect(`/cadastro?created=${result.id}`);
  } catch (error) {
    if (error instanceof ApiClientError)
      redirect(`/cadastro?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
}
