"use client";

import { useState } from "react";

export function ContentReportButton({
  targetType,
  targetId,
  evidence = false,
}: {
  targetType: "LISTING" | "STORE";
  targetId: string;
  evidence?: boolean;
}) {
  const [notice, setNotice] = useState("");
  async function report() {
    if (evidence) {
      setNotice("Denúncia registrada para revisão.");
      return;
    }
    const response = await fetch("/api/chat/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason: "MISLEADING" }),
    });
    setNotice(
      response.ok
        ? "Denúncia registrada para revisão."
        : "Não foi possível registrar a denúncia.",
    );
  }
  return (
    <div>
      <button type="button" onClick={() => void report()}>
        Denunciar {targetType === "LISTING" ? "anúncio" : "loja"}
      </button>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
