import type { ReactNode } from "react";

type AppShellProps = {
  area: string;
  description: string;
  children?: ReactNode;
};

export function AppShell({ area, description, children }: AppShellProps) {
  return (
    <main className="shell">
      <a className="skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header>
        <span className="mark" aria-hidden="true">
          PA
        </span>
        <strong>PARTSAGRICOLA</strong>
        <span className="area">{area}</span>
      </header>
      <section id="conteudo" className="content">
        <p className="eyebrow">Marketplace de peças agrícolas</p>
        <h1>{area}</h1>
        <p className="description">{description}</p>
        {children ?? (
          <div className="state" role="status">
            Base pronta para a próxima entrega.
          </div>
        )}
      </section>
    </main>
  );
}
