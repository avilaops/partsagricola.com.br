import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SellerDashboardPage() {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/painel");
  const client = createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
  const session = await client.session(token);
  const sellerId = session.seller_ids[0];
  if (!sellerId) redirect("/cadastro");
  const dashboard = await client.sellerDashboard(token, sellerId);
  const metrics = [
    ["Anúncios", dashboard.metrics.listings],
    ["Publicados", dashboard.metrics.publishedListings],
    ["Interesses abertos", dashboard.metrics.openInterests],
    ["Solicitações diretas", dashboard.metrics.openRequests],
  ];
  return (
    <AppShell
      area={dashboard.company.tradeName}
      description={`Situação da empresa: ${dashboard.company.status}.`}
    >
      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="panel-section">
        <h2>Próximas ações</h2>
        <p>
          Complete o perfil e aguarde a aprovação para publicar os primeiros
          anúncios.
        </p>
      </div>
      <div className="action-grid compact-actions">
        <Link
          className="action-card action-primary"
          href="/painel/anuncios/novo"
        >
          <span className="tag">Catálogo</span>
          <strong>Novo anúncio</strong>
          <p>Cadastre uma peça e envie para análise.</p>
        </Link>
        <Link className="action-card" href="/painel/anuncios">
          <span className="tag">Gestão</span>
          <strong>Meus anúncios</strong>
          <p>Acompanhe publicação e disponibilidade.</p>
        </Link>
      </div>
    </AppShell>
  );
}
