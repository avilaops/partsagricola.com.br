import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createCompanyApplication } from "./actions";

const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export default async function CompanyRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) redirect("/auth/login?next=/cadastro");
  const reference = await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  }).referenceData(token);
  const params = await searchParams;
  return (
    <AppShell
      area="Cadastrar empresa"
      description="Os dados serão analisados antes da liberação de anúncios. Cada empresa administra o próprio catálogo e suas condições comerciais."
    >
      {params.created ? (
        <div className="notice success" role="status">
          Cadastro enviado. Protocolo: <strong>{params.created}</strong>
        </div>
      ) : null}
      {params.error ? (
        <div className="notice error" role="alert">
          Não foi possível enviar o cadastro. Verifique os dados e se o CNPJ já
          está registrado.
        </div>
      ) : null}
      <form action={createCompanyApplication} className="form-card">
        <div className="form-grid">
          <label>
            CNPJ
            <input
              name="cnpj"
              inputMode="numeric"
              required
              minLength={14}
              maxLength={18}
            />
          </label>
          <label>
            Razão social
            <input name="legalName" required minLength={3} maxLength={180} />
          </label>
          <label>
            Nome fantasia
            <input name="tradeName" required minLength={2} maxLength={120} />
          </label>
          <label>
            E-mail comercial
            <input name="email" type="email" required />
          </label>
          <label>
            Telefone
            <input name="phone" type="tel" />
          </label>
          <label>
            Site
            <input name="website" type="url" placeholder="https://" />
          </label>
          <label>
            UF da sede
            <select name="stateCode" required defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {states.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <label>
            Cidade
            <input name="city" required minLength={2} maxLength={120} />
          </label>
        </div>
        <label>
          Sobre a empresa
          <textarea
            name="description"
            minLength={20}
            maxLength={1200}
            rows={5}
            placeholder="Especialidades, estrutura e experiência."
          />
        </label>
        <fieldset>
          <legend>Categorias atendidas</legend>
          <div className="check-grid">
            {reference.categories.map((item) => (
              <label className="check" key={item.id}>
                <input type="checkbox" name="categoryIds" value={item.id} />
                {item.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Estados atendidos</legend>
          <div className="check-grid states">
            {states.map((state) => (
              <label className="check" key={state}>
                <input type="checkbox" name="serviceRegions" value={state} />
                {state}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="button" type="submit">
          Enviar para análise
        </button>
      </form>
    </AppShell>
  );
}
