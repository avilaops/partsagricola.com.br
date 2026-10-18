import { BRAND } from "@partsagricola/config";
import type { ReactNode } from "react";

type AppShellProps = {
  area: string;
  description: string;
  children?: ReactNode;
};

export function AppShell({ area, description, children }: AppShellProps) {
  return (
    <div className="shell">
      <a className="skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="app-header">
        <span className="mark" aria-hidden="true">
          PA
        </span>
        <strong>{BRAND.name}</strong>
        <span className="area">{area}</span>
      </header>
      <main id="conteudo" className="content" tabIndex={-1}>
        <p className="eyebrow">Marketplace de peças agrícolas</p>
        <h1>{area}</h1>
        <p className="description">{description}</p>
        {children ?? (
          <p className="state">Base pronta para a próxima entrega.</p>
        )}
      </main>
    </div>
  );
}
