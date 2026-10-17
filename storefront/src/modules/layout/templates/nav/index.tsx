import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SideMenu from "@modules/layout/components/side-menu"

export default function Nav() {
  return (
    <div className="sticky inset-x-0 top-0 z-50">
      <header className="border-b border-ui-border-base bg-white/95 backdrop-blur-md">
        <nav
          aria-label="Navegação principal"
          className="content-container flex h-16 items-center justify-between gap-5"
        >
          <div className="flex h-full flex-1 items-center medium:hidden">
            <SideMenu
              whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(
                /\D/g,
                ""
              )}
            />
          </div>

          <LocalizedClientLink href="/" className="flex shrink-0 items-center">
            <span className="sr-only">Parts Agrícola</span>
            <Image
              src="/images/marca/logo-partsagricola.png"
              alt=""
              width={800}
              height={138}
              priority
              className="h-7 w-auto small:h-8"
            />
          </LocalizedClientLink>

          <div className="hidden flex-1 items-center justify-center gap-8 text-sm medium:flex">
            <LocalizedClientLink
              href="/#como-funciona"
              className="font-medium text-ui-fg-subtle hover:text-pa-verde"
            >
              Como funciona
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/#para-empresas"
              className="font-medium text-ui-fg-subtle hover:text-pa-verde"
            >
              Para empresas
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/contato"
              className="font-medium text-ui-fg-subtle hover:text-pa-verde"
            >
              Contato
            </LocalizedClientLink>
          </div>

          <div className="flex flex-1 justify-end">
            <LocalizedClientLink
              href="/contato?perfil=empresa"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-pa-verde px-4 text-sm font-semibold text-white hover:bg-[#08552e]"
            >
              <span className="hidden xsmall:inline">
                Anunciar como empresa
              </span>
              <span className="xsmall:hidden">Anunciar</span>
            </LocalizedClientLink>
          </div>
        </nav>
      </header>
    </div>
  )
}
