import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function InterestsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/conta/interesses");
  const { items } = await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  }).buyerInterests(token);
  const { created } = await searchParams;
  return (
    <AppShell
      area="Meus interesses"
      description="Acompanhe os anúncios consultados e as propostas recebidas."
    >
      {created ? (
        <p className="notice success">Interesse enviado ao vendedor.</p>
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
