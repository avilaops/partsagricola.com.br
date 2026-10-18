import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/painel/anuncios");
  const client = createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
  const session = await client.session(token);
  const sellerId = session.seller_ids[0];
  if (!sellerId) redirect("/cadastro");
  const { items } = await client.sellerListings(token, sellerId);
  const { created } = await searchParams;
  return (
    <AppShell
      area="Anúncios"
      description="Gerencie as peças exibidas aos compradores."
    >
      {created ? (
        <p className="notice success">Anúncio enviado para análise.</p>
      ) : null}
      <p>
        <Link className="button link-button" href="/painel/anuncios/novo">
          Novo anúncio
        </Link>
      </p>
      <div className="catalog-grid">
        {items.length ? (
          items.map((item) => (
            <article className="listing-card" key={item.id}>
              <span className="status-badge">{item.status}</span>
              <h2>{item.title}</h2>
              <p>
                {item.city}/{item.stateCode}
              </p>
              <strong>
                {item.priceOnRequest
                  ? "Preço sob consulta"
                  : new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format((item.priceAmountMinor ?? 0) / 100)}
              </strong>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h2>Nenhum anúncio ainda</h2>
            <p>Cadastre a primeira peça para iniciar sua vitrine.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
