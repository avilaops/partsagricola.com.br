import { AppShell } from "@partsagricola/ui";
import Link from "next/link";
export default function Page() {
  return (
    <AppShell
      area="Marketplace"
      description="Encontre empresas, publique sua necessidade e receba respostas de quem realmente tem a peça."
    >
      <div className="action-grid">
        <Link className="action-card" href="/catalogo">
          <span className="tag">Marketplace</span>
          <strong>Buscar peças e vendedores</strong>
          <p>
            Pesquise anúncios publicados por empresas verificadas em todo o
            Brasil.
          </p>
        </Link>
        <Link
          className="action-card action-primary"
          href="/conta/solicitacoes/nova"
        >
          <span className="tag">Para compradores</span>
          <strong>Solicitar uma peça</strong>
          <p>
            Informe código, aplicação ou medidas e envie a necessidade aos
            vendedores.
          </p>
        </Link>
        <a className="action-card" href="http://localhost:3001/cadastro">
          <span className="tag">Para empresas</span>
          <strong>Cadastrar minha empresa</strong>
          <p>
            Crie sua presença, selecione categorias e defina as regiões
            atendidas.
          </p>
        </a>
      </div>
    </AppShell>
  );
}
