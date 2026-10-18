import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { updateProfile } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/painel/perfil");
  const client = createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
  const sellerId = (await client.session(token)).seller_ids[0];
  if (!sellerId) redirect("/cadastro");
  const dashboard = await client.sellerDashboard(token, sellerId);
  const params = await searchParams;
  return (
    <AppShell
      area="Perfil público"
      description="Mantenha os dados que compradores veem na vitrine da sua empresa."
    >
      {params.saved ? (
        <p className="notice success">Perfil atualizado.</p>
      ) : null}
      {params.error ? (
        <p className="notice error">
          Não foi possível atualizar: {params.error}
        </p>
      ) : null}
      <form action={updateProfile} className="form-card">
        <div className="form-grid">
          <label>
            Nome fantasia
            <input
              name="tradeName"
              required
              minLength={2}
              defaultValue={dashboard.company.tradeName}
            />
          </label>
          <label>
            E-mail comercial
            <input
              name="email"
              type="email"
              required
              defaultValue={dashboard.company.email}
            />
          </label>
          <label>
            Telefone
            <input
              name="phone"
              type="tel"
              defaultValue={dashboard.company.phone ?? ""}
            />
          </label>
          <label>
            Site
            <input
              name="website"
              type="url"
              defaultValue={dashboard.company.website ?? ""}
              placeholder="https://"
            />
          </label>
          <label>
            Cidade
            <input
              name="city"
              required
              minLength={2}
              defaultValue={dashboard.company.city}
            />
          </label>
          <label>
            UF
            <input
              name="stateCode"
              required
              minLength={2}
              maxLength={2}
              defaultValue={dashboard.company.stateCode}
            />
          </label>
        </div>
        <label>
          Sobre a empresa
          <textarea
            name="description"
            minLength={20}
            maxLength={1200}
            rows={6}
            defaultValue={dashboard.company.description ?? ""}
          />
        </label>
        <button className="button" type="submit">
          Salvar perfil
        </button>
      </form>
    </AppShell>
  );
}
