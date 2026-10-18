"use client";

import { Button, StoreAvatar } from "@partsagricola/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type ChatMessageView = {
  id: string;
  sender: string;
  mine: boolean;
  safeBody: string;
  moderationStatus: "ALLOW" | "MASK" | "BLOCK" | "PENDING_REVIEW";
  readByRecipient?: boolean;
  attachments?: Array<{
    id: string;
    status: "QUARANTINED" | "APPROVED" | "REJECTED" | "REVIEW_REQUIRED";
    url?: string;
  }>;
  createdAt: string;
};

export function ChatClient({
  conversationId,
  title,
  company,
  verified,
  evidence,
  initialMessages,
}: {
  conversationId: string;
  title: string;
  company: string;
  verified: boolean;
  evidence: boolean;
  initialMessages: ChatMessageView[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"connecting" | "live" | "polling">(
    evidence ? "live" : "connecting",
  );
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (evidence) return;
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const refresh = async () => {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data: Array<{
          id: string;
          senderUserId: string;
          safeBody: string;
          moderationStatus: ChatMessageView["moderationStatus"];
          readByRecipient: boolean;
          mine: boolean;
          attachments: NonNullable<ChatMessageView["attachments"]>;
          createdAt: string;
        }>;
      };
      setMessages(
        payload.data.map((message) => ({
          ...message,
          sender: message.mine ? "Você" : "Participante",
        })),
      );
      void fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: "POST",
      });
    };
    const polling = () => {
      if (cancelled) return;
      if (timer) clearInterval(timer);
      setStatus("polling");
      void refresh();
      timer = setInterval(() => void refresh(), 5_000);
    };
    void refresh();
    void fetch(`/api/chat/conversations/${conversationId}/realtime-ticket`, {
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("ticket unavailable");
        return response.json() as Promise<{ wsUrl: string }>;
      })
      .then(({ wsUrl }) => {
        if (cancelled) return;
        socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          setStatus("live");
          timer = setInterval(() => void refresh(), 5_000);
        };
        socket.onmessage = (event) => {
          const payload = JSON.parse(event.data) as {
            type: string;
            data: {
              id: string;
              senderUserId: string;
              safeBody: string;
              moderationStatus: ChatMessageView["moderationStatus"];
              createdAt: string;
            };
          };
          if (payload.type === "message.created")
            setMessages((current) =>
              current.some((message) => message.id === payload.data.id)
                ? current
                : [
                    ...current,
                    { ...payload.data, sender: "Participante", mine: false },
                  ],
            );
        };
        socket.onerror = polling;
        socket.onclose = polling;
      })
      .catch(polling);
    return () => {
      cancelled = true;
      socket?.close();
      if (timer) clearInterval(timer);
    };
  }, [conversationId, evidence]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    if (evidence) {
      const blocked =
        /whats|\d[\s()-]*\d[\s()-]*\d[\s()-]*\d[\s()-]*\d[\s()-]*\d[\s()-]*\d[\s()-]*\d/i.test(
          body,
        );
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "Você",
          mine: true,
          safeBody: blocked ? "[conteúdo externo removido]" : body,
          moderationStatus: blocked ? "BLOCK" : "ALLOW",
          createdAt: new Date().toISOString(),
        },
      ]);
      if (blocked)
        setNotice("Contato externo removido para proteger a negociação.");
      return;
    }
    setSending(true);
    const response = await fetch(
      `/api/chat/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientMessageId: crypto.randomUUID(),
          body,
          attachments: [],
        }),
      },
    );
    if (!response.ok) {
      setNotice("Não foi possível enviar. Tente novamente.");
      setSending(false);
      return;
    }
    const message = (await response.json()) as Omit<
      ChatMessageView,
      "sender" | "mine"
    >;
    setMessages((current) =>
      current.some((item) => item.id === message.id)
        ? current.map((item) =>
            item.id === message.id
              ? { ...message, sender: "Você", mine: true }
              : item,
          )
        : [...current, { ...message, sender: "Você", mine: true }],
    );
    setSending(false);
  }

  async function report(messageId: string) {
    if (evidence) {
      setNotice("Denúncia registrada para revisão.");
      return;
    }
    const response = await fetch("/api/chat/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: "MESSAGE",
        targetId: messageId,
        reason: "OTHER",
      }),
    });
    setNotice(
      response.ok
        ? "Denúncia registrada para revisão."
        : "Não foi possível registrar a denúncia.",
    );
  }

  async function sendPhoto(file: File) {
    if (evidence) {
      setNotice("Foto anexada em quarentena para análise automática.");
      return;
    }
    setSending(true);
    try {
      const signed = await fetch("/api/chat/uploads/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!signed.ok) throw new Error("sign failed");
      const upload = (await signed.json()) as { key: string; url: string };
      const stored = await fetch(upload.url, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!stored.ok) throw new Error("upload failed");
      const response = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientMessageId: crypto.randomUUID(),
            body: "Foto enviada para análise",
            attachments: [{ storageKey: upload.key, mimeType: file.type }],
          }),
        },
      );
      if (!response.ok) throw new Error("message failed");
      const message = (await response.json()) as Omit<
        ChatMessageView,
        "sender" | "mine"
      >;
      setMessages((current) => [
        ...current.filter((item) => item.id !== message.id),
        { ...message, sender: "Você", mine: true },
      ]);
      setNotice("Foto em quarentena até a análise de segurança.");
    } catch {
      setNotice("Não foi possível anexar a foto.");
    } finally {
      setSending(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <main className="chat-page">
      <header className="chat-header">
        <Link href="/" className="chat-back" aria-label="Voltar">
          ←
        </Link>
        <div>
          <StoreAvatar name={company} verified={verified} />
          <p>{title}</p>
        </div>
        <span className={`chat-connection chat-connection--${status}`}>
          {status === "live"
            ? "Tempo real"
            : status === "polling"
              ? "Atualização automática"
              : "Conectando"}
        </span>
      </header>
      <section className="chat-safety">
        <strong>Negocie com segurança dentro da plataforma</strong>
        <span>Contatos externos e links são removidos automaticamente.</span>
      </section>
      <section className="chat-messages" aria-live="polite">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-bubble ${message.mine ? "chat-bubble--mine" : ""} ${message.moderationStatus !== "ALLOW" ? "chat-bubble--moderated" : ""}`}
          >
            <strong>{message.sender}</strong>
            <p>{message.safeBody}</p>
            {message.attachments?.map((attachment) =>
              attachment.status === "APPROVED" && attachment.url ? (
                // Signed, short-lived URL returned only to conversation participants.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={attachment.id}
                  src={attachment.url}
                  alt="Foto enviada na conversa"
                  className="chat-photo"
                />
              ) : (
                <small key={attachment.id}>
                  {attachment.status === "REJECTED"
                    ? "Foto removida pela moderação"
                    : "Foto em análise de segurança"}
                </small>
              ),
            )}
            {message.moderationStatus !== "ALLOW" && (
              <small>Protegido pela moderação</small>
            )}
            <time dateTime={message.createdAt}>
              {new Intl.DateTimeFormat("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(message.createdAt))}
              {message.mine && message.readByRecipient ? " · Lida" : ""}
            </time>
            {!message.mine && (
              <button type="button" onClick={() => void report(message.id)}>
                Denunciar
              </button>
            )}
          </article>
        ))}
        <div ref={bottom} />
      </section>
      {notice && (
        <p className="chat-notice" role="status">
          {notice}
        </p>
      )}
      <footer className="chat-composer">
        <button
          type="button"
          className="chat-attach"
          aria-label="Adicionar foto"
          disabled={sending}
          onClick={() => fileInput.current?.click()}
        >
          ＋
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void sendPhoto(file);
          }}
        />
        <label>
          <span className="sr-only">Mensagem</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Escreva uma mensagem segura…"
            maxLength={4000}
          />
        </label>
        <Button disabled={sending} onClick={() => void send()}>
          {sending ? "Enviando…" : "Enviar"}
        </Button>
      </footer>
    </main>
  );
}
