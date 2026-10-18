import { AppShell } from "@partsagricola/ui";
import Link from "next/link";
export default function Page() {
  return (
    <AppShell
      area="Área do vendedor"
      description="Cadastre sua empresa e administre anúncios, oportunidades e solicitações em um único painel."
    >
      <div className="action-grid">
        <Link className="action-card action-primary" href="/cadastro">
          <span className="tag">Primeiro acesso</span>
          <strong>Cadastrar minha empresa</strong>
          <p>
            Envie os dados comerciais, segmentos atendidos e regiões de atuação.
          </p>
        </Link>
        <Link className="action-card" href="/painel">
          <span className="tag">Empresa cadastrada</span>
          <strong>Acessar painel</strong>
          <p>
            Acompanhe anúncios publicados, interesses e solicitações recebidas.
          </p>
        </Link>
      </div>
    </AppShell>
  );
}
