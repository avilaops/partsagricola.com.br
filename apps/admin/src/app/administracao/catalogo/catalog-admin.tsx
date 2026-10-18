"use client";

import type {
  CatalogAdminEntity,
  CatalogAdminRecord,
} from "@partsagricola/api-client";
import { Button, Input, Toast } from "@partsagricola/ui";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  createPartAction,
  createCatalogEntityAction,
  deactivateCatalogEntityAction,
  deactivatePartAction,
  importCatalogAction,
  updatePartAction,
  updateCatalogEntityAction,
  type CatalogActionResult,
} from "./actions";

type PartRow = CatalogAdminRecord & {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};

const sections: Array<{ entity: CatalogAdminEntity; label: string }> = [
  { entity: "parts", label: "Peças" },
  { entity: "machine-types", label: "Tipos de máquina" },
  { entity: "brands", label: "Marcas" },
  { entity: "brand-associations", label: "Tipo × marca" },
  { entity: "models", label: "Modelos" },
  { entity: "categories", label: "Categorias" },
  { entity: "codes", label: "Códigos" },
  { entity: "compatibilities", label: "Compatibilidades" },
  { entity: "exchange-rates", label: "Câmbio" },
];
const csvHeader =
  "schema_version,source,external_id,part_name,part_code,code_type,brand,category,description,machine_type,machine_brand,machine_model,year_start,year_end";

export function CatalogAdmin({
  initialCatalog,
  evidence,
  loadError,
}: {
  initialCatalog: Record<CatalogAdminEntity, CatalogAdminRecord[]>;
  evidence: boolean;
  loadError: string;
}) {
  const [parts, setParts] = useState(() => initialCatalog.parts.map(asPart));
  const [activeEntity, setActiveEntity] = useState<CatalogAdminEntity>("parts");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(loadError ? { tone: "danger", text: loadError } : null);
  const [editing, setEditing] = useState<PartRow | null>(null);
  const [pending, startTransition] = useTransition();
  const partDialog = useRef<HTMLDialogElement>(null);
  const importDialog = useRef<HTMLDialogElement>(null);
  const filtered = useMemo(
    () =>
      parts.filter((part) =>
        [part.name, part.slug, part.brandName, part.categoryName].some(
          (value) =>
            String(value ?? "")
              .toLocaleLowerCase("pt-BR")
              .includes(query.toLocaleLowerCase("pt-BR")),
        ),
      ),
    [parts, query],
  );

  function openPart(part: PartRow | null) {
    setEditing(part);
    partDialog.current?.showModal();
  }

  function finish(result: CatalogActionResult, update?: () => void) {
    setNotice({ tone: result.ok ? "success" : "danger", text: result.message });
    if (result.ok) update?.();
  }

  async function submitPart(formData: FormData) {
    const body = {
      name: String(formData.get("name")),
      slug: String(formData.get("slug")),
      active: true,
    };
    const localResult: CatalogActionResult = {
      ok: true,
      record: { id: editing?.id ?? crypto.randomUUID(), ...body },
      message: editing ? "Alterações salvas" : "Peça cadastrada",
    };
    const result = evidence
      ? localResult
      : editing
        ? await updatePartAction(editing.id, body)
        : await createPartAction(body);
    finish(result, () => {
      const record = asPart(
        result.ok && result.record
          ? result.record
          : { id: editing?.id ?? crypto.randomUUID(), ...body },
      );
      setParts((current) =>
        editing
          ? current.map((part) =>
              part.id === editing.id ? { ...part, ...record } : part,
            )
          : [record, ...current],
      );
      partDialog.current?.close();
    });
  }

  async function deactivate(part: PartRow) {
    const result = evidence
      ? ({
          ok: true,
          record: { ...part, active: false },
          message: "Peça desativada",
        } satisfies CatalogActionResult)
      : await deactivatePartAction(part.id);
    finish(result, () =>
      setParts((current) =>
        current.map((item) =>
          item.id === part.id ? { ...item, active: false } : item,
        ),
      ),
    );
  }

  async function importCsv(formData: FormData) {
    const file = formData.get("csv");
    const csv = file instanceof File ? await file.text() : "";
    const suppliedColumns = (csv.split(/\r?\n/, 1)[0] ?? "")
      .replace(/^\uFEFF/, "")
      .split(",")
      .map((column) => column.trim());
    const expectedColumns = csvHeader.split(",");
    if (
      suppliedColumns.length !== expectedColumns.length ||
      new Set(suppliedColumns).size !== expectedColumns.length ||
      expectedColumns.some((column) => !suppliedColumns.includes(column))
    ) {
      setNotice(null);
      const alert = importDialog.current?.querySelector<HTMLElement>(
        "[data-import-error]",
      );
      if (alert) {
        alert.textContent =
          "Cabeçalho inválido. Use o modelo oficial de 14 colunas.";
        alert.hidden = false;
      }
      return;
    }
    const rows = Math.max(0, csv.trim().split(/\r?\n/).length - 1);
    const result = evidence
      ? ({
          ok: true,
          message: `${rows} ${rows === 1 ? "linha importada" : "linhas importadas"}`,
        } satisfies CatalogActionResult)
      : await importCatalogAction(csv);
    finish(result, () => importDialog.current?.close());
  }

  return (
    <div className="catalog-shell">
      <a className="skip" href="#catalog-content">
        Ir para o conteúdo
      </a>
      <aside className="catalog-rail" aria-label="Navegação administrativa">
        <Link
          className="catalog-mark"
          href="/"
          aria-label="Parts Agrícola — Administração"
        >
          <span>PA</span>
          <strong>Parts Agrícola</strong>
        </Link>
        <nav>
          <Link href="/">Visão geral</Link>
          <Link className="is-current" href="/administracao/catalogo">
            Catálogo
          </Link>
          <span>Anunciantes</span>
          <span>Moderação</span>
          <span>Auditoria</span>
        </nav>
        <p>
          Ambiente administrativo
          <br />
          <small>Operações auditadas</small>
        </p>
      </aside>
      <main id="catalog-content" tabIndex={-1} className="catalog-main">
        <header className="catalog-heading">
          <div>
            <p>Administração do marketplace</p>
            <h1>Catálogo de referências</h1>
            <span>
              Organize a base usada pelas empresas para publicar anúncios
              compatíveis.
            </span>
          </div>
          <div className="catalog-actions">
            <Button
              variant="secondary"
              onClick={() => importDialog.current?.showModal()}
            >
              Importar CSV
            </Button>
            {activeEntity === "parts" && (
              <Button onClick={() => openPart(null)}>Nova peça</Button>
            )}
          </div>
        </header>

        <section className="catalog-command" aria-label="Busca e seções">
          <label>
            <span>Buscar no catálogo</span>
            <input
              type="search"
              role="searchbox"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, código, marca ou aplicação"
            />
          </label>
          <div
            className="catalog-tabs"
            role="list"
            aria-label="Seções do catálogo"
          >
            {sections.map((section) => (
              <button
                type="button"
                key={section.entity}
                className={section.entity === activeEntity ? "is-active" : ""}
                onClick={() => {
                  setActiveEntity(section.entity);
                  setQuery("");
                }}
              >
                {section.label}
              </button>
            ))}
          </div>
        </section>

        {notice && <Toast tone={notice.tone}>{notice.text}</Toast>}
        {activeEntity === "parts" ? (
          <section
            className="catalog-ledger"
            aria-labelledby="records-title"
            aria-busy={pending}
          >
            <div className="catalog-ledger-head">
              <div>
                <h2 id="records-title">Peças cadastradas</h2>
                <p>
                  {filtered.length}{" "}
                  {filtered.length === 1
                    ? "referência encontrada"
                    : "referências encontradas"}
                </p>
              </div>
              <span>
                <i aria-hidden="true" /> Dados operacionais
              </span>
            </div>
            <div className="catalog-table-wrap">
              <table>
                <caption className="sr-only">Referências de peças</caption>
                <thead>
                  <tr>
                    <th>Referência</th>
                    <th>Marca</th>
                    <th>Categoria</th>
                    <th>Estado</th>
                    <th>Atualização</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((part) => (
                    <tr key={part.id}>
                      <td data-label="Referência">
                        <strong>{part.name}</strong>
                        <small>{part.slug}</small>
                      </td>
                      <td data-label="Marca">
                        {String(part.brandName ?? "Sem marca")}
                      </td>
                      <td data-label="Categoria">
                        {String(part.categoryName ?? "Sem categoria")}
                      </td>
                      <td data-label="Estado">
                        <span
                          className={`catalog-status ${part.active ? "is-active" : ""}`}
                        >
                          {part.active ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td data-label="Atualização">
                        {formatDate(part.updatedAt)}
                      </td>
                      <td data-label="Ações">
                        <div className="catalog-row-actions">
                          <button
                            type="button"
                            onClick={() => openPart(part)}
                            aria-label={`Editar ${part.name}`}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={!part.active || pending}
                            onClick={() =>
                              startTransition(() => void deactivate(part))
                            }
                            aria-label={`Desativar ${part.name}`}
                          >
                            Desativar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && (
                <div className="catalog-empty">
                  <strong>Nenhuma referência encontrada</strong>
                  <span>Revise a busca ou cadastre uma nova peça.</span>
                </div>
              )}
            </div>
          </section>
        ) : (
          <GenericEntityPanel
            entity={activeEntity}
            initialRecords={initialCatalog[activeEntity]}
            evidence={evidence}
            query={query}
            onNotice={setNotice}
          />
        )}
      </main>

      <dialog
        ref={partDialog}
        className="catalog-dialog"
        aria-labelledby="part-dialog-title"
      >
        <form action={(data) => startTransition(() => void submitPart(data))}>
          <header>
            <div>
              <p>{editing ? "Manutenção" : "Nova referência"}</p>
              <h2 id="part-dialog-title">
                {editing ? "Editar peça" : "Cadastrar peça"}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => partDialog.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="catalog-dialog-body">
            <Input
              name="name"
              label="Nome da peça"
              defaultValue={editing?.name ?? ""}
              required
            />
            <Input
              name="slug"
              label="Identificador amigável"
              hint="Use letras minúsculas, números e hífens."
              defaultValue={editing?.slug ?? ""}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </div>
          <footer>
            <Button
              type="button"
              variant="secondary"
              onClick={() => partDialog.current?.close()}
            >
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {editing ? "Salvar alterações" : "Salvar peça"}
            </Button>
          </footer>
        </form>
      </dialog>

      <dialog
        ref={importDialog}
        className="catalog-dialog"
        aria-labelledby="import-dialog-title"
      >
        <form action={(data) => startTransition(() => void importCsv(data))}>
          <header>
            <div>
              <p>Importação em lote</p>
              <h2 id="import-dialog-title">Importar catálogo por CSV</h2>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => importDialog.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="catalog-dialog-body">
            <label className="catalog-file">
              <strong>Arquivo CSV</strong>
              <span>
                O arquivo inteiro é validado antes de qualquer alteração.
              </span>
              <input name="csv" type="file" accept=".csv,text/csv" required />
            </label>
            <p data-import-error role="alert" hidden />
          </div>
          <footer>
            <Button
              type="button"
              variant="secondary"
              onClick={() => importDialog.current?.close()}
            >
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              Validar e importar
            </Button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}

type FieldDefinition = {
  name: string;
  label: string;
  type?: "text" | "number" | "datetime-local";
  required?: boolean;
};
const entityFields: Record<CatalogAdminEntity, FieldDefinition[]> = {
  "machine-types": [
    { name: "name", label: "Nome", required: true },
    { name: "slug", label: "Identificador", required: true },
  ],
  brands: [
    { name: "name", label: "Nome", required: true },
    { name: "slug", label: "Identificador", required: true },
    { name: "logoUrl", label: "URL do logotipo" },
  ],
  "brand-associations": [
    { name: "machineTypeId", label: "ID do tipo de máquina", required: true },
    { name: "brandId", label: "ID da marca", required: true },
  ],
  models: [
    { name: "machineTypeId", label: "ID do tipo de máquina", required: true },
    { name: "brandId", label: "ID da marca", required: true },
    { name: "name", label: "Nome", required: true },
    { name: "slug", label: "Identificador", required: true },
    { name: "yearStart", label: "Ano inicial", type: "number" },
    { name: "yearEnd", label: "Ano final", type: "number" },
  ],
  categories: [
    { name: "parentId", label: "ID da categoria superior" },
    { name: "name", label: "Nome", required: true },
    { name: "slug", label: "Identificador", required: true },
  ],
  parts: [],
  codes: [
    { name: "partId", label: "ID da peça", required: true },
    { name: "code", label: "Código", required: true },
    {
      name: "kind",
      label: "Tipo (ORIGINAL, EQUIVALENT, OEM, GTIN ou SUPPLIER)",
      required: true,
    },
    { name: "source", label: "Fonte" },
  ],
  compatibilities: [
    { name: "partId", label: "ID da peça", required: true },
    { name: "modelId", label: "ID do modelo", required: true },
    { name: "yearStart", label: "Ano inicial", type: "number" },
    { name: "yearEnd", label: "Ano final", type: "number" },
    { name: "notes", label: "Observações" },
  ],
  "exchange-rates": [
    { name: "baseCurrency", label: "Moeda de origem", required: true },
    { name: "quoteCurrency", label: "Moeda de destino", required: true },
    { name: "rate", label: "Taxa", type: "number", required: true },
    {
      name: "effectiveAt",
      label: "Vigência",
      type: "datetime-local",
      required: true,
    },
  ],
};

function GenericEntityPanel({
  entity,
  initialRecords,
  evidence,
  query,
  onNotice,
}: {
  entity: CatalogAdminEntity;
  initialRecords: CatalogAdminRecord[];
  evidence: boolean;
  query: string;
  onNotice(value: { tone: "success" | "danger"; text: string }): void;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [editing, setEditing] = useState<CatalogAdminRecord | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const section = sections.find((item) => item.entity === entity)!;
  const visible = records.filter((record) =>
    JSON.stringify(record)
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const displayName = (record: CatalogAdminRecord) =>
    String(
      record.name ?? record.code ?? record.slug ?? record.id ?? "Referência",
    );

  async function save(formData: FormData) {
    const body: CatalogAdminRecord = { active: true };
    for (const field of entityFields[entity]) {
      const raw = String(formData.get(field.name) ?? "").trim();
      if (!raw) continue;
      body[field.name] =
        field.type === "number"
          ? Number(raw)
          : field.type === "datetime-local"
            ? new Date(raw).toISOString()
            : raw;
    }
    const id = String(editing?.id ?? crypto.randomUUID());
    const result = evidence
      ? ({
          ok: true,
          record: { ...editing, id, ...body },
          message: editing ? "Alterações salvas" : "Referência cadastrada",
        } satisfies CatalogActionResult)
      : editing
        ? await updateCatalogEntityAction(entity, id, body)
        : await createCatalogEntityAction(entity, body);
    onNotice({ tone: result.ok ? "success" : "danger", text: result.message });
    if (result.ok) {
      const record = result.record ?? { ...editing, id, ...body };
      setRecords((current) =>
        editing
          ? current.map((item) => (item.id === editing.id ? record : item))
          : [record, ...current],
      );
      dialog.current?.close();
    }
  }

  async function deactivate(record: CatalogAdminRecord) {
    const id = String(record.id);
    const result = evidence
      ? ({
          ok: true,
          record: { ...record, active: false },
          message: "Referência desativada",
        } satisfies CatalogActionResult)
      : await deactivateCatalogEntityAction(entity, id);
    onNotice({ tone: result.ok ? "success" : "danger", text: result.message });
    if (result.ok)
      setRecords((current) =>
        current.map((item) =>
          item.id === record.id ? { ...item, active: false } : item,
        ),
      );
  }

  return (
    <section className="catalog-ledger" aria-labelledby="generic-records-title">
      <div className="catalog-ledger-head">
        <div>
          <h2 id="generic-records-title">{section.label}</h2>
          <p>{visible.length} referências</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            dialog.current?.showModal();
          }}
        >
          Nova referência
        </Button>
      </div>
      <div className="catalog-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Referência</th>
              <th>Identificador</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((record) => (
              <tr key={String(record.id)}>
                <td data-label="Referência">
                  <strong>{displayName(record)}</strong>
                </td>
                <td data-label="Identificador">
                  <small>{String(record.slug ?? record.id)}</small>
                </td>
                <td data-label="Estado">
                  <span
                    className={`catalog-status ${record.active !== false ? "is-active" : ""}`}
                  >
                    {record.active !== false ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td data-label="Ações">
                  <div className="catalog-row-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(record);
                        dialog.current?.showModal();
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={record.active === false || pending}
                      onClick={() =>
                        startTransition(() => void deactivate(record))
                      }
                    >
                      Desativar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="catalog-empty">
            <strong>Nenhuma referência cadastrada</strong>
            <span>Cadastre a primeira referência desta seção.</span>
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className="catalog-dialog"
        aria-labelledby="generic-dialog-title"
      >
        <form action={(data) => startTransition(() => void save(data))}>
          <header>
            <div>
              <p>{section.label}</p>
              <h2 id="generic-dialog-title">
                {editing ? "Editar referência" : "Cadastrar referência"}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="catalog-dialog-body">
            {entityFields[entity].map((field) => (
              <Input
                key={field.name}
                name={field.name}
                label={field.label}
                type={field.type ?? "text"}
                step={
                  field.type === "number" && field.name === "rate"
                    ? "any"
                    : undefined
                }
                defaultValue={String(editing?.[field.name] ?? "")}
                required={field.required}
              />
            ))}
          </div>
          <footer>
            <Button
              type="button"
              variant="secondary"
              onClick={() => dialog.current?.close()}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Salvar referência
            </Button>
          </footer>
        </form>
      </dialog>
    </section>
  );
}

function asPart(record: CatalogAdminRecord): PartRow {
  return {
    ...record,
    id: String(record.id ?? crypto.randomUUID()),
    name: String(record.name ?? "Sem nome"),
    slug: String(record.slug ?? "sem-identificador"),
    active: record.active !== false,
  };
}
function formatDate(value: unknown) {
  if (typeof value !== "string") return "Agora";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
