import type { PublicCatalogResponse } from "@partsagricola/api-client";
import Link from "next/link";

export function SeoListings({
  items,
}: {
  items: PublicCatalogResponse["items"];
}) {
  return (
    <div className="catalog-grid">
      {items.length ? (
        items.map((item) => (
          <article className="listing-card" key={item.id}>
            <span className="tag">{item.condition}</span>
            <h2>
              <Link href={`/anuncios/${item.id}`}>{item.title}</Link>
            </h2>
            <p>{item.description}</p>
            <strong>
              {item.priceOnRequest
                ? "Preço sob consulta"
                : new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format((item.priceAmountMinor ?? 0) / 100)}
            </strong>
            <p>
              {item.city}/{item.stateCode}
            </p>
            <Link href={`/vendedores/${item.company.slug}`}>
              {item.company.tradeName}
            </Link>
          </article>
        ))
      ) : (
        <div className="empty-state">
          <h2>Novos anúncios em breve</h2>
          <p>Envie sua necessidade para os vendedores cadastrados.</p>
          <Link href="/conta/solicitacoes/nova">Solicitar uma peça</Link>
        </div>
      )}
    </div>
  );
}
