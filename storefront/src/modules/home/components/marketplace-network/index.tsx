import Image from "next/image"

const MarketplaceNetwork = () => {
  return (
    <section className="content-container py-12 small:py-20">
      <div className="grid overflow-hidden rounded-[28px] border border-ui-border-base bg-pa-superficie medium:grid-cols-[1.15fr_0.85fr]">
        <div className="relative min-h-[320px] small:min-h-[420px]">
          <Image
            src="/images/marketplace/rede-fornecedores.webp"
            alt="Estoques de fornecedores especializados conectados em um catálogo único"
            fill
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover object-[35%_center]"
          />
        </div>

        <div className="flex flex-col justify-center p-7 small:p-10 medium:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pa-verde">
            Um marketplace especializado
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-pa-grafite small:text-4xl">
            A plataforma conecta. Cada vendedor cuida dos próprios produtos.
          </h2>
          <p className="mt-4 text-base leading-7 text-ui-fg-subtle">
            Cada empresa cliente publica o catálogo, administra preços e mantém
            seu próprio estoque. A Parts Agrícola fornece a plataforma de vendas
            que reúne essas ofertas.
          </p>
          <p className="mt-4 text-base leading-7 text-ui-fg-subtle">
            O comprador encontra opções em um só lugar, confirma a aplicação e
            negocia com o vendedor responsável pelo produto.
          </p>
        </div>
      </div>
    </section>
  )
}

export default MarketplaceNetwork
