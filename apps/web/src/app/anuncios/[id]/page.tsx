import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createInterest } from "../../catalogo/actions";

type Props = { params: Promise<{ id: string }> };

async function loadListing(id: string) {
  return createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  })
    .publicListing(id)
    .catch(() => null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await loadListing((await params).id);
  if (!listing) return { title: "Anúncio não encontrado" };
  return {
    title: `${listing.title} | PartsAgrícola`,
    description: listing.description.slice(0, 160),
  };
}

export default async function ListingPage({ params }: Props) {
  const listing = await loadListing((await params).id);
  if (!listing) notFound();
  const price = listing.priceOnRequest
    ? "Preço sob consulta"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format((listing.priceAmountMinor ?? 0) / 100);

  return (
    <AppShell area={listing.title} description={listing.description}>
      <div className="listing-detail">
        <section className="listing-gallery" aria-label="Fotos do anúncio">
          {listing.images.length ? (
            listing.images.map((image, index) => (
              // Imagens fornecidas e validadas pelo vendedor.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.url}
                src={image.url}
                alt={image.altText || `${listing.title}, foto ${index + 1}`}
              />
            ))
          ) : (
            <div className="image-placeholder">
              Vendedor ainda não enviou fotos
            </div>
          )}
        </section>

        <aside className="listing-summary">
          <span className="tag">{listing.condition}</span>
          <strong className="listing-price">{price}</strong>
          <p>
            {listing.city}/{listing.stateCode}
          </p>
          {listing.part ? (
            <dl className="listing-specs">
              <div>
                <dt>Peça</dt>
                <dd>{listing.part.name}</dd>
              </div>
              {listing.part.brand ? (
                <div>
                  <dt>Marca</dt>
                  <dd>{listing.part.brand}</dd>
                </div>
              ) : null}
              {listing.part.category ? (
                <div>
                  <dt>Categoria</dt>
                  <dd>{listing.part.category}</dd>
                </div>
              ) : null}
              {listing.part.codes.length ? (
                <div>
                  <dt>Códigos</dt>
                  <dd>{listing.part.codes.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <form action={createInterest} className="interest-form">
            <input type="hidden" name="listingId" value={listing.id} />
            <label>
              Mensagem ao vendedor
              <textarea
                name="message"
                rows={3}
                placeholder="Confirme aplicação, disponibilidade ou prazo"
              />
            </label>
            <button className="button" type="submit">
              Falar com o vendedor
            </button>
          </form>
        </aside>
      </div>

      <section className="seller-profile listing-seller">
        <div>
          <span className="verified-badge">
            {listing.company.verified ? "CNPJ verificado" : "Em verificação"}
          </span>
          <h2>{listing.company.tradeName}</h2>
          <p>
            {listing.company.city}/{listing.company.stateCode}
          </p>
          <p>
            {listing.company.rating === null
              ? "Vendedor ainda sem avaliações"
              : `${listing.company.rating.toFixed(1)} de 5 · ${listing.company.reviewCount} avaliações`}
          </p>
        </div>
        <Link href={`/vendedores/${listing.company.slug}`}>
          Ver perfil da empresa
        </Link>
      </section>
    </AppShell>
  );
}
