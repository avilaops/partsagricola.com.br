import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function Footer() {
  return (
    <footer className="w-full border-t border-ui-border-base bg-white">
      <div className="content-container py-12 small:py-16">
        <div className="grid gap-10 small:grid-cols-[1fr_auto] small:items-start">
          <div className="max-w-md">
            <LocalizedClientLink href="/" className="inline-flex items-center">
              <Image
                src="/images/marca/logo-partsagricola.png"
                alt="Parts Agrícola"
                width={800}
                height={138}
                className="h-8 w-auto"
              />
            </LocalizedClientLink>
            <p className="mt-5 leading-7 text-ui-fg-subtle">
              Marketplace que conecta empresas anunciantes a compradores do
              setor agrícola. A Parts Agrícola não vende estoque próprio.
            </p>
          </div>
          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="font-semibold text-pa-grafite">Marketplace</p>
              <ul className="mt-3 space-y-2 text-ui-fg-subtle">
                <li>
                  <a href="#como-funciona" className="hover:text-pa-verde">
                    Como funciona
                  </a>
                </li>
                <li>
                  <a href="#para-empresas" className="hover:text-pa-verde">
                    Para empresas
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-pa-grafite">Atendimento</p>
              <ul className="mt-3 space-y-2 text-ui-fg-subtle">
                <li>
                  <LocalizedClientLink
                    href="/contato"
                    className="hover:text-pa-verde"
                  >
                    Fale com a equipe
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-12 border-t border-ui-border-base pt-6 text-sm text-ui-fg-muted">
          © {new Date().getFullYear()} Parts Agrícola. Todos os direitos
          reservados.
        </div>
      </div>
    </footer>
  )
}
