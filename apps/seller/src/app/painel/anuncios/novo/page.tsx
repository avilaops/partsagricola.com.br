import { AppShell } from "@partsagricola/ui";
import { createListing } from "./actions";
import { ImageUploader } from "./image-uploader";

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AppShell
      area="Área do vendedor"
      description="Cadastre uma peça. A publicação ocorre após a análise da plataforma."
    >
      {error ? (
        <p className="notice error">
          Não foi possível salvar o anúncio: {error}
        </p>
      ) : null}
      <form action={createListing} className="form-card">
        <div className="form-grid">
          <label>
            Título
            <input
              name="title"
              required
              minLength={3}
              placeholder="Ex.: Bomba hidráulica John Deere"
            />
          </label>
          <label>
            Condição
            <select name="condition">
              <option value="NEW">Nova</option>
              <option value="USED">Usada</option>
              <option value="RECONDITIONED">Recondicionada</option>
              <option value="REMANUFACTURED">Remanufaturada</option>
            </select>
          </label>
          <label>
            Estado
            <input
              name="stateCode"
              required
              minLength={2}
              maxLength={2}
              placeholder="SP"
            />
          </label>
          <label>
            Cidade
            <input name="city" required minLength={2} />
          </label>
          <label>
            Preço em reais
            <input name="price" inputMode="decimal" placeholder="1250,00" />
          </label>
          <label className="check">
            <input name="priceOnRequest" type="checkbox" /> Preço sob consulta
          </label>
        </div>
        <label>
          Descrição
          <textarea
            name="description"
            required
            minLength={10}
            rows={6}
            placeholder="Informe códigos, aplicações, medidas e estado da peça."
          />
        </label>
        <ImageUploader />
        <button className="button" type="submit">
          Enviar para análise
        </button>
      </form>
    </AppShell>
  );
}
