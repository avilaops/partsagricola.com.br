import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import Link from "next/link";
import { createInterest, reportListing } from "./actions";
import { CompareButton, CompareTray } from "./compare";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    busca?: string;
    estado?: string;
    error?: string;
    reported?: string;
  }>;
}) {
  const filters = await searchParams;
  const { items } = await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  }).publicCatalog({ query: filters.busca, stateCode: filters.estado });
  return (
    <AppShell
      area="Catálogo"
      description="Peças anunciadas por empresas do setor agrícola. Fale diretamente com o vendedor."
    >
      {filters.error ? (
        <p className="notice error">
          Não foi possível registrar o interesse: {filters.error}
        </p>
      ) : null}
      {filters.reported ? (
        <p className="notice success">Denúncia enviada para análise.</p>
      ) : null}
      <form className="search-bar">
        <input
          aria-label="Buscar anúncios"
          name="busca"
          defaultValue={filters.busca}
          placeholder="Código, peça ou aplicação"
        />
        <input
          aria-label="Estado"
          name="estado"
          defaultValue={filters.estado}
          maxLength={2}
          placeholder="UF"
        />
        <button className="button" type="submit">
          Buscar
        </button>
      </form>
      <div className="catalog-grid">
        {items.length ? (
          items.map((item) => (
            <article className="listing-card" key={item.id}>
              {item.imageUrl ? (
                <Link href={`/anuncios/${item.id}`}>
                  {/* URLs pertencem aos vendedores e são validadas pela API. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.title} />
                </Link>
              ) : (
                <div className="image-placeholder">Imagem do vendedor</div>
              )}
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
                {item.company.verified ? " · Verificada" : ""}
              </Link>
              <CompareButton listing={item} />
              <form action={createInterest} className="interest-form">
                <input type="hidden" name="listingId" value={item.id} />
                <input
                  name="message"
                  aria-label={`Mensagem sobre ${item.title}`}
                  placeholder="Mensagem opcional ao vendedor"
                />
                <button className="button" type="submit">
                  Tenho interesse
                </button>
              </form>
              <details className="report-box">
                <summary>Denunciar anúncio</summary>
                <form action={reportListing} className="interest-form">
                  <input type="hidden" name="listingId" value={item.id} />
                  <input
                    name="reason"
                    required
                    minLength={3}
                    placeholder="Explique o problema"
                  />
                  <button className="button button-secondary" type="submit">
                    Enviar denúncia
                  </button>
                </form>
              </details>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h2>Nenhum anúncio encontrado</h2>
            <p>
              Altere os filtros ou publique uma solicitação para os vendedores.
            </p>
            <Link href="/conta/solicitacoes/nova">Solicitar uma peça</Link>
          </div>
        )}
      </div>
      <CompareTray />
    </AppShell>
  );
}
