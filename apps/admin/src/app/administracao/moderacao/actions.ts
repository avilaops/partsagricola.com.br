"use server";

import { cookies } from "next/headers";

export type ModerationActionResult =
  | { ok: true; message: string; data?: unknown }
  | { ok: false; message: string };

async function request(
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown,
) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) throw new Error("Sessão administrativa ausente");
  const response = await fetch(
    new URL(path, process.env.API_ORIGIN ?? "http://localhost:4100"),
    {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "Falha na moderação");
  return payload;
}

export async function loadHistoryAction(query: {
  companyId?: string;
  userId?: string;
}): Promise<ModerationActionResult> {
  try {
    const parameters = new URLSearchParams(
      query.companyId
        ? { companyId: query.companyId }
        : { userId: query.userId! },
    );
    const data = await request(
      `/v1/moderation/history?${parameters.toString()}`,
      "GET",
    );
    return { ok: true, message: "Histórico carregado", data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Falha no histórico",
    };
  }
}

export async function reviewFlagAction(
  id: string,
  outcome: "CONFIRMED" | "DISMISSED",
  note: string,
): Promise<ModerationActionResult> {
  try {
    const data = await request(`/v1/moderation/flags/${id}/review`, "POST", {
      outcome,
      note,
    });
    return {
      ok: true,
      message:
        outcome === "CONFIRMED"
          ? "Ocorrência confirmada"
          : "Ocorrência descartada",
      data,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Falha na revisão",
    };
  }
}

export async function updatePolicyAction(body: {
  warningThreshold: number;
  suspendThreshold: number;
  blockThreshold: number;
  suspensionHours: number;
}): Promise<ModerationActionResult> {
  try {
    const data = await request("/v1/moderation/policy", "PUT", body);
    return { ok: true, message: "Política atualizada", data };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Falha ao salvar política",
    };
  }
}
