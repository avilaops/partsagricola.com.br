import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { moderate, resolveCase } from "../actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login");
  const client = createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
  const principal = await client.session(token);
  if (!principal.roles.some((role) => ["ADMIN", "SUPPORT"].includes(role)))
    redirect("/auth/login");
  const queue = await client.adminModeration(token);
  const { updated } = await searchParams;
  return (
    <AppShell
      area="Administração"
      description="Controle operacional e auditoria do marketplace em uma interface central."
    >
      {updated ? (
        <p className="notice success">Decisão aplicada e auditada.</p>
      ) : null}
      <section className="panel-section">
        <h2>Empresas aguardando análise</h2>
        <div className="moderation-list">
          {queue.companies.length ? (
            queue.companies.map((company) => (
              <article className="moderation-item" key={company.id}>
                <div>
                  <strong>{company.tradeName}</strong>
                  <p>
                    {company.cnpj} · {company.city}/{company.stateCode}
                  </p>
                </div>
                <form action={moderate} className="decision-row">
                  <input type="hidden" name="entity" value="company" />
                  <input type="hidden" name="id" value={company.id} />
                  <button className="button" name="decision" value="APPROVED">
                    Aprovar
                  </button>
                  <button
                    className="button button-secondary"
                    name="decision"
                    value="REJECTED"
                  >
                    Rejeitar
                  </button>
                </form>
              </article>
            ))
          ) : (
            <p>Nenhuma empresa pendente.</p>
          )}
        </div>
      </section>
      <section className="panel-section">
        <h2>Denúncias abertas</h2>
        <div className="moderation-list">
          {queue.cases.length ? (
            queue.cases.map((item) => (
              <article className="moderation-item" key={item.id}>
                <div>
                  <strong>{item.entityType}</strong>
                  <p>{item.reason}</p>
                  <small>{item.entityId}</small>
                </div>
                <form action={resolveCase} className="proposal-form">
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    name="resolution"
                    required
                    minLength={3}
                    placeholder="Conclusão da análise"
                  />
                  <div className="decision-row">
                    <button className="button" name="decision" value="RESOLVED">
                      Resolver
                    </button>
                    <button
                      className="button button-secondary"
                      name="decision"
                      value="DISMISSED"
                    >
                      Descartar
                    </button>
                  </div>
                </form>
              </article>
            ))
          ) : (
            <p>Nenhuma denúncia aberta.</p>
          )}
        </div>
      </section>
      <section className="panel-section">
        <h2>Anúncios aguardando análise</h2>
        <div className="moderation-list">
          {queue.listings.length ? (
            queue.listings.map((listing) => (
              <article className="moderation-item" key={listing.id}>
                <div>
                  <strong>{listing.title}</strong>
                  <p>{listing.companyName}</p>
                </div>
                <form action={moderate} className="decision-row">
                  <input type="hidden" name="entity" value="listing" />
                  <input type="hidden" name="id" value={listing.id} />
                  <button className="button" name="decision" value="PUBLISHED">
                    Publicar
                  </button>
                  <button
                    className="button button-secondary"
                    name="decision"
                    value="REJECTED"
                  >
                    Rejeitar
                  </button>
                </form>
              </article>
            ))
          ) : (
            <p>Nenhum anúncio pendente.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
