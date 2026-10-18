import { ChatClient, type ChatMessageView } from "./chat-client";
import "./chat.css";

const evidenceMessages: ChatMessageView[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    sender: "Agro Forte Peças",
    mine: false,
    safeBody:
      "Olá! Temos a bomba hidráulica compatível com o MF 290. A peça é nova e tem 12 meses de garantia.",
    moderationStatus: "ALLOW",
    createdAt: "2026-10-18T13:42:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    sender: "Você",
    mine: true,
    safeBody: "O prazo de despacho é de quantos dias úteis?",
    moderationStatus: "ALLOW",
    createdAt: "2026-10-18T13:45:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    sender: "Agro Forte Peças",
    mine: false,
    safeBody: "[canal externo removido] [telefone removido]",
    moderationStatus: "BLOCK",
    createdAt: "2026-10-18T13:47:00.000Z",
  },
];

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ evidence?: string }>;
}) {
  const id = (await params).id;
  const evidence =
    (await searchParams).evidence === "1" &&
    process.env.NODE_ENV !== "production";
  return (
    <ChatClient
      conversationId={id}
      title="Bomba hidráulica MF 290"
      company="Agro Forte Peças"
      verified
      evidence={evidence}
      initialMessages={evidence ? evidenceMessages : []}
    />
  );
}
