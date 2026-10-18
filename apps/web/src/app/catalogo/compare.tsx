"use client";

import type { PublicCatalogResponse } from "@partsagricola/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Listing = PublicCatalogResponse["items"][number];
type CompareItem = Pick<
  Listing,
  | "id"
  | "title"
  | "condition"
  | "priceAmountMinor"
  | "priceOnRequest"
  | "city"
  | "stateCode"
  | "imageUrl"
  | "company"
>;

const storageKey = "partsagricola_compare_v1";
const eventName = "partsagricola:compare";

function readItems(): CompareItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function writeItems(items: CompareItem[]) {
  localStorage.setItem(storageKey, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(eventName, { detail: items }));
}

export function CompareButton({ listing }: { listing: Listing }) {
  const [selected, setSelected] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const sync = () => {
      const items = readItems();
      setSelected(items.some((item) => item.id === listing.id));
      setFull(items.length >= 4);
    };
    sync();
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(eventName, sync);
      window.removeEventListener("storage", sync);
    };
  }, [listing.id]);

  function toggle() {
    const items = readItems();
    if (selected) writeItems(items.filter((item) => item.id !== listing.id));
    else if (items.length < 4) writeItems([...items, listing]);
  }

  return (
    <button
      className="compare-button"
      type="button"
      onClick={toggle}
      disabled={!selected && full}
      aria-pressed={selected}
    >
      {selected
        ? "Remover da comparação"
        : full
          ? "Limite de 4 peças"
          : "Comparar"}
    </button>
  );
}

export function CompareTray() {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<CompareItem[]> | undefined)?.detail;
      setItems(detail ?? readItems());
    };
    sync();
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(eventName, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!items.length) return null;
  return (
    <aside className="compare-tray" aria-label="Comparação de peças">
      <div className="compare-tray-header">
        <strong>
          {items.length}{" "}
          {items.length === 1 ? "peça selecionada" : "peças selecionadas"}
        </strong>
        <div>
          <button type="button" onClick={() => setOpen((value) => !value)}>
            {open ? "Fechar comparação" : "Comparar agora"}
          </button>
          <button type="button" onClick={() => writeItems([])}>
            Limpar
          </button>
        </div>
      </div>
      {open ? (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Critério</th>
                {items.map((item) => (
                  <th key={item.id}>
                    <Link href={`/anuncios/${item.id}`}>{item.title}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Condição</th>
                {items.map((item) => (
                  <td key={item.id}>{item.condition}</td>
                ))}
              </tr>
              <tr>
                <th>Preço</th>
                {items.map((item) => (
                  <td key={item.id}>
                    {item.priceOnRequest
                      ? "Sob consulta"
                      : new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format((item.priceAmountMinor ?? 0) / 100)}
                  </td>
                ))}
              </tr>
              <tr>
                <th>Localização</th>
                {items.map((item) => (
                  <td key={item.id}>
                    {item.city}/{item.stateCode}
                  </td>
                ))}
              </tr>
              <tr>
                <th>Vendedor</th>
                {items.map((item) => (
                  <td key={item.id}>
                    {item.company.tradeName}
                    {item.company.verified ? " · Verificado" : ""}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p>
            Compare os dados publicados e confirme a aplicação diretamente com o
            vendedor.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
