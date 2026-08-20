import { listCategories } from "@lib/data/categories"
import { selectPrimaryDepartments } from "@lib/catalog/departments"
import { Text } from "@medusajs/ui"
import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import MedusaCTA from "@modules/layout/components/medusa-cta"

export default async function Footer() {
  const productCategories = await listCategories()
  const departments = selectPrimaryDepartments(productCategories)

  return (
    <footer className="border-t border-ui-border-base w-full">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col items-start justify-between gap-10 py-14 small:flex-row small:py-16">
          <div>
            <LocalizedClientLink href="/" className="flex items-center">
              <Image
                src="/images/marca/logo-partsagricola.png"
                alt="Parts Agricola"
                width={800}
                height={138}
                className="h-8 w-auto"
              />
            </LocalizedClientLink>
          </div>
          <div className="grid grid-cols-2 gap-10 text-small-regular small:grid-cols-3 medium:gap-x-16">
            {departments.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus txt-ui-fg-base">
                  Categorias
                </span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {departments.map((c) => (
                    <li className="text-ui-fg-subtle txt-small" key={c.id}>
                      <LocalizedClientLink
                        className="hover:text-[#0B6B3F]"
                        href={`/categories/${c.handle}`}
                        data-testid="category-link"
                      >
                        {c.name}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <span className="txt-small-plus txt-ui-fg-base">
                Encontrar peças
              </span>
              <ul className="grid grid-cols-1 gap-2 text-ui-fg-subtle txt-small">
                <li>
                  <LocalizedClientLink
                    className="hover:text-[#0B6B3F]"
                    href="/store"
                  >
                    Catálogo completo
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    className="hover:text-[#0B6B3F]"
                    href="/medidas"
                  >
                    Buscar por medidas
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-y-2">
              <span className="txt-small-plus txt-ui-fg-base">Empresa</span>
              <ul className="grid grid-cols-1 gap-y-2 text-ui-fg-subtle txt-small">
                <li>
                  <LocalizedClientLink
                    href="/contato"
                    className="hover:text-ui-fg-base"
                  >
                    Fale com a gente
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    href="/confirmacao-tecnica"
                    className="hover:text-ui-fg-base"
                  >
                    Confirmação técnica
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col justify-between gap-3 border-t border-ui-border-base py-6 text-ui-fg-muted xsmall:flex-row">
          <Text className="txt-compact-small">
            © {new Date().getFullYear()} Parts Agricola. Todos os direitos
            reservados.
          </Text>
          <MedusaCTA />
        </div>
      </div>
    </footer>
  )
}
