"use server";

import { createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function moderate(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login");
  await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  }).moderate(
    token,
    String(formData.get("entity")) as "company" | "listing",
    String(formData.get("id")),
    String(formData.get("decision")) as "APPROVED" | "PUBLISHED" | "REJECTED",
  );
  redirect("/administracao?updated=1");
}

export async function resolveCase(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login");
  await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  }).resolveModerationCase(
    token,
    String(formData.get("id")),
    String(formData.get("decision")) as "RESOLVED" | "DISMISSED",
    String(formData.get("resolution") ?? ""),
  );
  redirect("/administracao?updated=1");
}
