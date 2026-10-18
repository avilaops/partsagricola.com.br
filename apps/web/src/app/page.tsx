import { AppShell } from "@partsagricola/ui";
import Image from "next/image";
import Link from "next/link";
export default function Page() {
  const sellerUrl =
    process.env.NEXT_PUBLIC_SELLER_URL ?? "http://localhost:3001";
  return (
    <AppShell
      area="Peças agrícolas, de quem vende para quem precisa"
      description="Pesquise anúncios de empresas do setor ou publique sua necessidade para receber propostas. A PartsAgrícola conecta as partes; cada vendedor administra seus próprios produtos."
    >
      <section className="home-hero" aria-label="Apresentação do marketplace">
        <Image
          src="/images/hero-marketplace.png"
          alt="Componentes agrícolas anunciados por empresas do setor"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1088px"
        />
        <form action="/catalogo" className="hero-search">
          <label htmlFor="busca-inicial">O que você precisa encontrar?</label>
          <div>
            <input
              id="busca-inicial"
              name="busca"
              placeholder="Código, peça, máquina ou aplicação"
            />
            <button className="button" type="submit">
              Buscar no marketplace
            </button>
          </div>
        </form>
      </section>

      <div className="trust-strip" aria-label="Diferenciais da plataforma">
        <span>
          <strong>Empresas verificadas</strong> pela plataforma
        </span>
        <span>
          <strong>Contato direto</strong> com o vendedor
        </span>
        <span>
          <strong>Solicitação aberta</strong> para encontrar peças difíceis
        </span>
      </div>

      <section className="home-section">
        <p className="eyebrow">Dois caminhos, uma conexão</p>
        <h2>Comece pelo que você precisa fazer</h2>
        <div className="action-grid">
          <Link className="action-card action-primary" href="/catalogo">
            <span className="tag">Para compradores</span>
            <strong>Encontrar uma peça</strong>
            <p>
              Compare anúncios, confira o vendedor e manifeste interesse
              diretamente.
            </p>
          </Link>
          <Link className="action-card" href="/conta/solicitacoes/nova">
            <span className="tag">Não encontrou?</span>
            <strong>Publicar uma solicitação</strong>
            <p>
              Informe código, aplicação ou medidas para receber propostas dos
              vendedores.
            </p>
          </Link>
          <a className="action-card" href={`${sellerUrl}/cadastro`}>
            <span className="tag">Para empresas</span>
            <strong>Vender na plataforma</strong>
            <p>
              Cadastre sua empresa, publique seu próprio catálogo e responda
              compradores.
            </p>
          </a>
        </div>
      </section>

      <section className="home-section steps-section">
        <p className="eyebrow">Como funciona</p>
        <h2>Da busca à proposta em três etapas</h2>
        <div className="steps-grid">
          <article>
            <span>01</span>
            <strong>Busque ou solicite</strong>
            <p>Use código, nome, marca ou aplicação da máquina.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Converse com empresas</strong>
            <p>Receba respostas de vendedores cadastrados e verificados.</p>
          </article>
          <article>
            <span>03</span>
            <strong>Escolha a proposta</strong>
            <p>Analise preço, prazo e reputação antes de decidir.</p>
          </article>
        </div>
      </section>

      <section className="seller-callout">
        <div>
          <p className="eyebrow">Sua empresa no marketplace</p>
          <h2>Você cuida do estoque. A plataforma aproxima compradores.</h2>
          <p>
            Crie sua vitrine, publique anúncios e acompanhe oportunidades em um
            painel próprio.
          </p>
        </div>
        <a className="button link-button" href={`${sellerUrl}/cadastro`}>
          Cadastrar empresa
        </a>
      </section>
    </AppShell>
  );
}
