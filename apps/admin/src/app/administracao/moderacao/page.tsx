import { cookies } from "next/headers";
import {
  ModerationAdmin,
  type ModerationFlagView,
  type ModerationPolicyView,
} from "./moderation-admin";
import "./moderation-admin.css";

const evidenceFlags: ModerationFlagView[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    contentType: "MESSAGE",
    decision: "BLOCK",
    source: "SYNC",
    reasons: ["PHONE", "MESSENGER"],
    status: "OPEN",
    redactedExcerpt: "[canal externo removido] [telefone removido]",
    userId: "11111111-1111-4111-8111-111111111111",
    companyLabel: "Agro Forte Peças",
    userLabel: "Carlos Mendes",
    createdAt: "2026-10-18T14:32:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    contentType: "IMAGE",
    decision: "MASK",
    source: "ASYNC_OCR",
    reasons: ["EMAIL"],
    status: "OPEN",
    redactedExcerpt: "Imagem em quarentena — e-mail detectado",
    companyLabel: "Trator Sul Componentes",
    userLabel: "Marina Costa",
    createdAt: "2026-10-18T13:08:00.000Z",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    contentType: "STORE",
    decision: "MASK",
    source: "REPORT",
    reasons: ["SOCIAL"],
    status: "OPEN",
    redactedExcerpt: "[rede social removida]",
    companyLabel: "Central do Campo",
    userLabel: "Denúncia de comprador",
    createdAt: "2026-10-18T11:45:00.000Z",
  },
];

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ evidence?: string }>;
}) {
  const evidence =
    (await searchParams).evidence === "1" &&
    process.env.NODE_ENV !== "production";
  let flags = evidence ? evidenceFlags : [];
  let policy: ModerationPolicyView = {
    warningThreshold: 1,
    suspendThreshold: 3,
    blockThreshold: 5,
    suspensionHours: 72,
  };
  let loadError = "";
  if (!evidence) {
    const token = (await cookies()).get("pa_access")?.value;
    if (token) {
      try {
        const origin = process.env.API_ORIGIN ?? "http://localhost:4100";
        const [response, policyResponse] = await Promise.all([
          fetch(new URL("/v1/moderation/flags?status=OPEN", origin), {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
          }),
          fetch(new URL("/v1/moderation/policy", origin), {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
          }),
        ]);
        const payload = (await response.json()) as {
          data?: ModerationFlagView[];
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(payload.error?.message ?? "Falha ao carregar fila");
        flags = payload.data ?? [];
        if (policyResponse.ok)
          policy = (await policyResponse.json()) as ModerationPolicyView;
      } catch (error) {
        loadError =
          error instanceof Error ? error.message : "Falha ao carregar fila";
      }
    }
  }
  return (
    <ModerationAdmin
      initialFlags={flags}
      evidence={evidence}
      loadError={loadError}
      initialPolicy={policy}
    />
  );
}
