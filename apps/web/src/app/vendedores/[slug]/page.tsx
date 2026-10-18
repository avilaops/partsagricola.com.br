import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { notFound } from "next/navigation";

export default async function SellerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  })
    .publicSeller(slug)
    .catch(() => null);
  if (!data) notFound();
  return (
    <AppShell
      area="Vendedor"
      description={
        data.company.description ??
        "Empresa participante do marketplace PartsAgrícola."
      }
    >
      <section className="seller-profile">
        <span className="verified-badge">
          {data.company.verified ? "CNPJ verificado" : "Em verificação"}
        </span>
        <h2>{data.company.tradeName}</h2>
        <p>
          <strong>Reputação:</strong>{" "}
          {data.company.rating === null
            ? "Ainda sem avaliações"
            : `${data.company.rating.toFixed(1)} de 5 (${data.company.reviewCount})`}
        </p>
        <p>
          {data.company.city}/{data.company.stateCode}
        </p>
        <p>
          <strong>Categorias:</strong>{" "}
          {data.company.categories.join(", ") || "Não informadas"}
        </p>
        <p>
          <strong>Atendimento:</strong> {data.company.serviceRegions.join(", ")}
        </p>
      </section>
      <h2>Anúncios desta empresa</h2>
      <div className="catalog-grid">
        {data.listings.map((item) => (
          <article className="listing-card" key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <strong>
              {item.priceOnRequest
                ? "Preço sob consulta"
                : new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format((item.priceAmountMinor ?? 0) / 100)}
            </strong>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
