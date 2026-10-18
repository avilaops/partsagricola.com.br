import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createProposal } from "./actions";

export default async function SellerInterestsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/painel/interesses");
  const client = createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
  const sellerId = (await client.session(token)).seller_ids[0];
  if (!sellerId) redirect("/cadastro");
  const { items } = await client.sellerInterests(token, sellerId);
  const state = await searchParams;
  return (
    <AppShell
      area="Interesses recebidos"
      description="Responda compradores com condições comerciais claras."
    >
      {state.sent ? (
        <p className="notice success">Proposta enviada ao comprador.</p>
      ) : null}
      {state.error ? (
        <p className="notice error">Não foi possível enviar: {state.error}</p>
      ) : null}
      <div className="quote-list">
        {items.length ? (
          items.map((item) => (
            <article className="quote-card" key={item.id}>
              <span className="status-badge">{item.status}</span>
              <h2>{item.listing.title}</h2>
              <p>
                <strong>Comprador:</strong> {item.buyer.name} ·{" "}
                {item.buyer.email}
              </p>
              {item.message ? <p>{item.message}</p> : null}
              {item.latestProposal ? (
                <div className="proposal">
                  <strong>Última proposta</strong>
                  <p>{item.latestProposal.terms}</p>
                </div>
              ) : null}
              <form action={createProposal} className="proposal-form">
                <input type="hidden" name="interestId" value={item.id} />
                <label>
                  Valor em reais
                  <input
                    name="amount"
                    inputMode="decimal"
                    placeholder="Opcional"
                  />
                </label>
                <label>
                  Condições
                  <textarea
                    name="terms"
                    required
                    minLength={3}
                    rows={4}
                    placeholder="Prazo, frete, garantia e validade"
                  />
                </label>
                <button className="button" type="submit">
                  Enviar proposta
                </button>
              </form>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h2>Nenhum interesse recebido</h2>
            <p>Os contatos dos compradores aparecerão aqui.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
