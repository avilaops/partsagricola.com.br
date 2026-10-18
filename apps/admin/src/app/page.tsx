import { AppShell } from "@partsagricola/ui";
import Link from "next/link";

export default function Page() {
  return (
    <AppShell
      area="Administração"
      description="Controle operacional e auditoria do marketplace em uma interface central."
    >
      <div className="action-grid">
        <Link className="action-card action-primary" href="/administracao">
          <span className="tag">Acesso restrito</span>
          <strong>Entrar no painel</strong>
          <p>Analise empresas, anúncios e decisões registradas.</p>
        </Link>
      </div>
    </AppShell>
  );
}
