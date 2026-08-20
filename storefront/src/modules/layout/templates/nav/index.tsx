import Image from "next/image"
import { Suspense } from "react"

import { listRegions } from "@lib/data/regions"
import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Cart } from "@modules/common/icons/parts"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import { listCategories } from "@lib/data/categories"
import QuoteListButton from "@modules/quote-list/components/quote-list-button"
import SavedProductsButton from "@modules/saved-products/components/saved-products-button"
import { selectPrimaryDepartments } from "@lib/catalog/departments"

export default async function Nav() {
  const [regions, locales, currentLocale, categories] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    listCategories(),
  ])
  const departments = selectPrimaryDepartments(categories)

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <header className="relative mx-auto border-b duration-200 bg-white border-ui-border-base">
        <nav className="content-container txt-xsmall-plus text-ui-fg-subtle flex h-16 items-center justify-between w-full text-small-regular">
          <div className="flex-1 basis-0 h-full flex items-center">
            <div className="h-full">
              <SideMenu
                regions={regions}
                locales={locales}
                currentLocale={currentLocale}
                categories={departments}
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
            <div className="hidden small:flex items-center gap-x-6 h-full">
              <LocalizedClientLink
                className="hover:text-ui-fg-base"
                href="/account"
                data-testid="nav-account-link"
              >
                Conta
              </LocalizedClientLink>
            </div>
            <SavedProductsButton />
            <QuoteListButton />
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="hover:text-ui-fg-base flex gap-2"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  <span className="hidden small:inline">Carrinho (0)</span>
                  <span className="flex items-center gap-1 small:hidden">
                    <Cart aria-hidden="true" className="h-4 w-4" />
                    <span>(0)</span>
                  </span>
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
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
