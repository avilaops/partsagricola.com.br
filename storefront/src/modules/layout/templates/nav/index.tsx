import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SideMenu from "@modules/layout/components/side-menu"
import { listCategories } from "@lib/data/categories"
import QuoteListButton from "@modules/quote-list/components/quote-list-button"
import SavedProductsButton from "@modules/saved-products/components/saved-products-button"
import { selectPrimaryDepartments } from "@lib/catalog/departments"

export default async function Nav() {
  const categories = await listCategories()
  const departments = selectPrimaryDepartments(categories)

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <header className="relative mx-auto border-b duration-200 bg-white border-ui-border-base">
        <nav className="content-container txt-xsmall-plus text-ui-fg-subtle flex h-16 items-center justify-between w-full text-small-regular">
          <div className="flex-1 basis-0 h-full flex items-center">
            <div className="h-full">
              <SideMenu
                categories={departments}
                whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(
                  /\D/g,
                  ""
                )}
              />
            </div>
          </div>

          <div className="flex items-center h-full">
            <LocalizedClientLink
              href="/"
              className="flex items-center"
              data-testid="nav-store-link"
            >
              <span className="sr-only">Parts Agrícola</span>
              <Image
                src="/images/marca/simbolo-partsagricola.png"
                alt=""
                width={256}
                height={255}
                priority
                className="h-8 w-8 object-contain small:hidden"
              />
              {/* `priority`: a logo esta no topo de toda pagina, entao e quase
                  sempre o maior elemento visivel no primeiro paint. Sem isso o
                  Next adia o carregamento e o LCP piora. */}
              <Image
                src="/images/marca/logo-partsagricola.png"
                alt=""
                width={800}
                height={138}
                priority
                className="hidden h-8 w-auto small:block"
              />
            </LocalizedClientLink>
          </div>

          <div className="flex items-center gap-x-6 h-full flex-1 basis-0 justify-end">
            <SavedProductsButton />
            <QuoteListButton />
          </div>
        </nav>
        <div className="hidden border-t border-ui-border-base bg-[#fafcfb] medium:block">
          <div className="content-container flex h-11 items-center justify-center gap-8 text-sm">
            {departments.map((category) => (
              <LocalizedClientLink
                key={category.id}
                href={`/categories/${category.handle}`}
                className="font-medium text-ui-fg-subtle transition-colors hover:text-[#0B6B3F]"
              >
                {category.name}
              </LocalizedClientLink>
            ))}
            <LocalizedClientLink
              href="/medidas"
              className="font-medium text-ui-fg-subtle transition-colors hover:text-[#0B6B3F]"
            >
              Buscar por medidas
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/store"
              className="font-semibold text-[#0B6B3F]"
            >
              Todas as peças
            </LocalizedClientLink>
          </div>
        </div>
      </header>
    </div>
  )
}
