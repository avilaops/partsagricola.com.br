import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createReview, decideProposal } from "./actions";

export default async function InterestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    decided?: string;
    reviewed?: string;
    error?: string;
  }>;
}) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/conta/interesses");
  const { items } = await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  }).buyerInterests(token);
  const state = await searchParams;
  return (
    <AppShell
      area="Meus interesses"
      description="Acompanhe os anúncios consultados e as propostas recebidas."
    >
      {state.created ? (
        <p className="notice success">Interesse enviado ao vendedor.</p>
      ) : null}
      {state.decided ? (
        <p className="notice success">Decisão registrada.</p>
      ) : null}
      {state.reviewed ? (
        <p className="notice success">Avaliação publicada.</p>
      ) : null}
      {state.error ? (
        <p className="notice error">Não foi possível concluir: {state.error}</p>
      ) : null}
      <div className="quote-list">
        {items.length ? (
          items.map((item) => (
            <article className="quote-card" key={item.id}>
              <span className="status-badge">{item.status}</span>
              <h2>{item.listing.title}</h2>
              {item.message ? <p>Sua mensagem: {item.message}</p> : null}
              {item.latestProposal ? (
                <div className="proposal">
                  <strong>Proposta recebida</strong>
                  <p>{item.latestProposal.terms}</p>
                  <b>
                    {item.latestProposal.amountMinor === null
                      ? "Valor a combinar"
                      : new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(item.latestProposal.amountMinor / 100)}
                  </b>
                </div>
              ) : (
                <p>Aguardando resposta do vendedor.</p>
              )}
              {item.latestProposal?.status === "SENT" ? (
                <form action={decideProposal} className="decision-row">
                  <input
                    type="hidden"
                    name="proposalId"
                    value={item.latestProposal.id}
                  />
                  <button className="button" name="decision" value="ACCEPTED">
                    Aceitar proposta
                  </button>
                  <button
                    className="button button-secondary"
                    name="decision"
                    value="REJECTED"
                  >
                    Recusar
                  </button>
                </form>
              ) : null}
              {item.latestProposal?.status === "ACCEPTED" ? (
                <form action={createReview} className="proposal-form">
                  <input
                    type="hidden"
                    name="proposalId"
                    value={item.latestProposal.id}
                  />
                  <label>
                    Nota
                    <select name="rating" defaultValue="5">
                      <option value="5">5 — Excelente</option>
                      <option value="4">4 — Muito bom</option>
                      <option value="3">3 — Bom</option>
                      <option value="2">2 — Ruim</option>
                      <option value="1">1 — Péssimo</option>
                    </select>
                  </label>
                  <label>
                    Comentário
                    <textarea name="comment" minLength={3} rows={3} />
                  </label>
                  <button className="button" type="submit">
                    Publicar avaliação
                  </button>
                </form>
              ) : null}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h2>Nenhum interesse enviado</h2>
            <p>Use o catálogo para falar com um vendedor.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
