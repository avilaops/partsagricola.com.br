"use client";

import { Button, Card, Input, Select } from "@partsagricola/ui";
import { useMemo, useState, useTransition } from "react";
import {
  loadHistoryAction,
  reviewFlagAction,
  updatePolicyAction,
} from "./actions";

export type ModerationFlagView = {
  id: string;
  contentType: "MESSAGE" | "LISTING" | "STORE" | "IMAGE";
  decision: "ALLOW" | "MASK" | "BLOCK";
  source: "SYNC" | "ASYNC_TEXT" | "ASYNC_OCR" | "REPORT" | "REVIEW";
  reasons: string[];
  status: "OPEN" | "APPROVED" | "REJECTED" | "RESOLVED";
  redactedExcerpt?: string;
  companyId?: string;
  userId?: string;
  companyLabel?: string;
  userLabel?: string;
  createdAt: string;
};

export function ModerationAdmin({
  initialFlags,
  evidence,
  loadError,
  initialPolicy,
}: {
  initialFlags: ModerationFlagView[];
  evidence: boolean;
  loadError: string;
  initialPolicy: ModerationPolicyView;
}) {
  const [flags, setFlags] = useState(initialFlags);
  const [filter, setFilter] = useState("ALL");
  const [notice, setNotice] = useState(loadError);
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState("");
  const visible = useMemo(
    () => flags.filter((flag) => filter === "ALL" || flag.decision === filter),
    [filter, flags],
  );
  function review(id: string, outcome: "CONFIRMED" | "DISMISSED") {
    startTransition(async () => {
      const result = evidence
        ? { ok: true as const, message: "Evidência local atualizada" }
        : await reviewFlagAction(
            id,
            outcome,
            outcome === "CONFIRMED"
              ? "Tentativa de contato externo confirmada"
              : "Falso positivo revisado",
          );
      setNotice(result.message);
      if (result.ok)
        setFlags((current) => current.filter((flag) => flag.id !== id));
    });
  }
  function loadHistory(flag: ModerationFlagView, subject: "company" | "user") {
    startTransition(async () => {
      if (evidence) {
        setHistory("3 ocorrências e 1 sanção nos últimos 180 dias");
        return;
      }
      if (subject === "company" && !flag.companyId) return;
      if (subject === "user" && !flag.userId) return;
      const result = await loadHistoryAction(
        subject === "company"
          ? { companyId: flag.companyId! }
          : { userId: flag.userId! },
      );
      setNotice(result.message);
      if (result.ok) {
        const data = result.data as { flags: unknown[]; sanctions: unknown[] };
        setHistory(
          `${data.flags.length} ocorrências e ${data.sanctions.length} sanções`,
        );
      }
    });
  }
  return (
    <main className="moderation-page">
      <header className="moderation-hero">
        <div>
          <p className="moderation-eyebrow">Segurança do marketplace</p>
          <h1>Central de moderação</h1>
          <p>
            Revise tentativas de contato externo sem expor os dados originais.
          </p>
        </div>
        <div className="moderation-summary" aria-label="Resumo da fila">
          <strong>{flags.length}</strong>
          <span>aguardando revisão</span>
        </div>
      </header>

      {notice && (
        <p className="moderation-notice" role="status">
          {notice}
        </p>
      )}
      {history && <p className="moderation-history">Histórico: {history}</p>}

      <section className="moderation-layout">
        <div>
          <div className="moderation-toolbar">
            <h2>Fila prioritária</h2>
            <Select
              label="Filtrar decisão"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="ALL">Todas</option>
              <option value="BLOCK">Bloqueadas</option>
              <option value="MASK">Mascaradas</option>
            </Select>
          </div>
          <div className="moderation-list" aria-busy={pending}>
            {visible.map((flag) => (
              <Card className="moderation-card" key={flag.id}>
                <div className="moderation-card-head">
                  <span
                    className={`moderation-severity moderation-severity--${flag.decision.toLowerCase()}`}
                  >
                    {flag.decision === "BLOCK" ? "Bloqueado" : "Mascarado"}
                  </span>
                  <time dateTime={flag.createdAt}>
                    {new Intl.DateTimeFormat("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(flag.createdAt))}
                  </time>
                </div>
                <h3>{flag.companyLabel ?? flag.contentType}</h3>
                <p className="moderation-user">
                  {flag.userLabel ?? "Usuário protegido"}
                </p>
                <blockquote>
                  {flag.redactedExcerpt ?? "[conteúdo protegido]"}
                </blockquote>
                <div className="moderation-reasons">
                  {flag.reasons.map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                  <span>{flag.source}</span>
                </div>
                <div className="moderation-actions">
                  {(flag.companyId || evidence) && (
                    <Button
                      disabled={pending}
                      variant="secondary"
                      onClick={() => loadHistory(flag, "company")}
                    >
                      Histórico da empresa
                    </Button>
                  )}
                  {(flag.userId || evidence) && (
                    <Button
                      disabled={pending}
                      variant="secondary"
                      onClick={() => loadHistory(flag, "user")}
                    >
                      Histórico do usuário
                    </Button>
                  )}
                  <Button
                    disabled={pending}
                    onClick={() => review(flag.id, "CONFIRMED")}
                  >
                    Confirmar ocorrência
                  </Button>
                  <Button
                    disabled={pending}
                    variant="secondary"
                    onClick={() => review(flag.id, "DISMISSED")}
                  >
                    Descartar
                  </Button>
                </div>
              </Card>
            ))}
            {!visible.length && (
              <div className="moderation-empty">
                <strong>Fila revisada</strong>
                <p>Nenhuma ocorrência neste filtro.</p>
              </div>
            )}
          </div>
        </div>
        <PolicyCard
          evidence={evidence}
          initialPolicy={initialPolicy}
          onNotice={setNotice}
        />
      </section>
    </main>
  );
}

function PolicyCard({
  evidence,
  initialPolicy,
  onNotice,
}: {
  evidence: boolean;
  initialPolicy: ModerationPolicyView;
  onNotice(value: string): void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <aside className="moderation-policy">
      <p className="moderation-eyebrow">Proteção progressiva</p>
      <h2>Política de sanções</h2>
      <p>Os limiares contam ocorrências confirmadas nos últimos 180 dias.</p>
      <form
        action={(formData) =>
          startTransition(async () => {
            const body = {
              warningThreshold: Number(formData.get("warning")),
              suspendThreshold: Number(formData.get("suspend")),
              blockThreshold: Number(formData.get("block")),
              suspensionHours: Number(formData.get("hours")),
            };
            const result = evidence
              ? { ok: true, message: "Política de evidência salva" }
              : await updatePolicyAction(body);
            onNotice(result.message);
          })
        }
      >
        <Input
          name="warning"
          label="Advertência"
          type="number"
          min="1"
          defaultValue={initialPolicy.warningThreshold}
        />
        <Input
          name="suspend"
          label="Suspensão"
          type="number"
          min="1"
          defaultValue={initialPolicy.suspendThreshold}
        />
        <Input
          name="block"
          label="Bloqueio"
          type="number"
          min="1"
          defaultValue={initialPolicy.blockThreshold}
        />
        <Input
          name="hours"
          label="Duração da suspensão (horas)"
          type="number"
          min="1"
          defaultValue={initialPolicy.suspensionHours}
        />
        <Button disabled={pending} type="submit">
          {pending ? "Salvando…" : "Salvar política"}
        </Button>
      </form>
      <small>Somente administradores podem alterar estes valores.</small>
    </aside>
  );
}

export type ModerationPolicyView = {
  warningThreshold: number;
  suspendThreshold: number;
  blockThreshold: number;
  suspensionHours: number;
};
