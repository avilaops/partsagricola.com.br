"use server";

import { ApiClientError, createApiClient } from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const client = () =>
  createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
export async function decideProposal(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/conta/interesses");
  try {
    await client().decideProposal(
      token,
      String(formData.get("proposalId") ?? ""),
      String(formData.get("decision")) as "ACCEPTED" | "REJECTED",
    );
    redirect("/conta/interesses?decided=1");
  } catch (error) {
    if (error instanceof ApiClientError)
      redirect(`/conta/interesses?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
}
export async function createReview(formData: FormData) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/conta/interesses");
  try {
    await client().createReview(
      token,
      String(formData.get("proposalId") ?? ""),
      {
        rating: Number(formData.get("rating")),
        ...(formData.get("comment")
          ? { comment: String(formData.get("comment")) }
          : {}),
      },
    );
    redirect("/conta/interesses?reviewed=1");
  } catch (error) {
    if (error instanceof ApiClientError)
      redirect(`/conta/interesses?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
}
