import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { removeFavorite } from "./actions";

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; removed?: string }>;
}) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/conta/favoritos");
  const { items } = await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  }).favorites(token);
  const params = await searchParams;
  return (
    <AppShell
      area="Anúncios salvos"
      description="Guarde peças para revisar, comparar e falar com os vendedores depois."
    >
      {params.saved ? <p className="notice success">Anúncio salvo.</p> : null}
      {params.removed ? (
        <p className="notice success">Anúncio removido dos salvos.</p>
      ) : null}
      <div className="catalog-grid">
        {items.length ? (
          items.map((item) => (
            <article className="listing-card" key={item.id}>
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.title} />
              ) : (
                <div className="image-placeholder">Imagem do vendedor</div>
              )}
              <h2>
                <Link href={`/anuncios/${item.id}`}>{item.title}</Link>
              </h2>
              <p>
                {item.city}/{item.stateCode} · {item.company.tradeName}
              </p>
              <form action={removeFavorite}>
                <input type="hidden" name="listingId" value={item.id} />
                <button className="compare-button" type="submit">
                  Remover dos salvos
                </button>
              </form>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h2>Nenhum anúncio salvo</h2>
            <p>Use o catálogo para montar sua seleção.</p>
            <Link href="/catalogo">Explorar catálogo</Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
