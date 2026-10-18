import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createPartRequest } from "./actions";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/conta/solicitacoes/nova");
  const reference = await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  }).referenceData(token);
  const params = await searchParams;
  return (
    <AppShell
      area="Solicitar uma peça"
      description="Descreva a necessidade com dados suficientes para os vendedores avaliarem compatibilidade e disponibilidade."
    >
      {params.created ? (
        <div className="notice success" role="status">
          Solicitação registrada. Protocolo: <strong>{params.created}</strong>
        </div>
      ) : null}
      {params.error ? (
        <div className="notice error" role="alert">
          Não foi possível registrar a solicitação. Revise os campos e tente
          novamente.
        </div>
      ) : null}
      <form action={createPartRequest} className="form-card">
        <label>
          Peça ou necessidade
          <input
            name="title"
            minLength={3}
            maxLength={160}
            required
            placeholder="Ex.: bomba hidráulica para colheitadeira"
          />
        </label>
        <div className="form-grid">
          <label>
            Categoria
            <select name="categoryId" defaultValue="">
              <option value="">Não sei informar</option>
              {reference.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Marca
            <select name="brandId" defaultValue="">
              <option value="">Não sei informar</option>
              {reference.brands.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Código, máquina, ano, quantidade e cidade de entrega
          <textarea
            name="description"
            minLength={10}
            maxLength={3000}
            required
            rows={7}
            placeholder="Inclua tudo que ajude o vendedor a identificar a aplicação correta."
          />
        </label>
        <button className="button" type="submit">
          Publicar solicitação
        </button>
      </form>
    </AppShell>
  );
}
