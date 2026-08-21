"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import { XMark } from "@medusajs/icons"
import { Fragment } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

const NAVEGACAO = [
  { href: "/", label: "Início" },
  { href: "/store", label: "Catálogo completo" },
  { href: "/medidas", label: "Busca por medidas" },
  { href: "/confirmacao-tecnica", label: "Confirmação técnica" },
  { href: "/contato", label: "Contato" },
]

type SideMenuProps = {
  categories: HttpTypes.StoreProductCategory[]
  whatsappNumber?: string
}

/**
 * Menu lateral limpo: painel branco que entra pela esquerda, listas com
 * divisórias finas e um só CTA no rodapé (WhatsApp). A versão herdada do
 * starter era um vidro escuro sobre a página, com links gigantes e seletor de
 * país/idioma que esta loja nunca teve.
 */
const SideMenu = ({ categories, whatsappNumber }: SideMenuProps) => {
  return (
    <div className="h-full">
      <div className="flex h-full items-center">
        <Popover className="flex h-full">
          {({ open, close }) => (
            <>
              <Popover.Button
                data-testid="nav-menu-button"
                className="relative flex h-full items-center transition-colors hover:text-ui-fg-base focus:outline-none"
              >
                Menu
              </Popover.Button>

              {open && (
                <div
                  className="fixed inset-0 z-[50] bg-black/30"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="-translate-x-full opacity-0"
                enterTo="translate-x-0 opacity-100"
                leave="transition ease-in duration-150"
                leaveFrom="translate-x-0 opacity-100"
                leaveTo="-translate-x-full opacity-0"
              >
                <PopoverPanel className="fixed inset-y-0 left-0 z-[51] flex w-[86vw] max-w-sm flex-col bg-white text-ui-fg-base shadow-2xl">
                  <div
                    data-testid="nav-menu-popup"
                    className="flex h-full flex-col"
                  >
                    <div className="flex items-center justify-between border-b border-ui-border-base px-5 py-4">
                      <span className="text-sm font-semibold uppercase tracking-[0.16em] text-pa-verde">
                        Parts Agrícola
                      </span>
                      <button
                        data-testid="close-menu-button"
                        onClick={close}
                        aria-label="Fechar menu"
                        className="rounded-full p-1.5 text-ui-fg-subtle hover:bg-pa-superficie hover:text-ui-fg-base"
                      >
                        <XMark />
                      </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-5 py-4">
                      <ul className="divide-y divide-ui-border-base">
                        {NAVEGACAO.map((item) => (
                          <li key={item.href}>
                            <LocalizedClientLink
                              href={item.href}
                              onClick={close}
                              className="flex items-center justify-between py-3.5 text-base font-medium hover:text-pa-verde"
                            >
                              {item.label}
                              <span aria-hidden="true" className="text-ui-fg-muted">
                                →
                              </span>
                            </LocalizedClientLink>
                          </li>
                        ))}
                      </ul>

                      <p className="mb-2 mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
                        Departamentos
                      </p>
                      <ul className="divide-y divide-ui-border-base">
                        {categories.map((category) => (
                          <li key={category.id}>
                            <LocalizedClientLink
                              href={`/categories/${category.handle}`}
                              onClick={close}
                              className="flex items-center justify-between py-3 text-sm hover:text-pa-verde"
                            >
                              {category.name}
                              <span aria-hidden="true" className="text-ui-fg-muted">
                                →
                              </span>
                            </LocalizedClientLink>
                          </li>
                        ))}
                      </ul>
                    </nav>

                    <div className="border-t border-ui-border-base px-5 py-4">
                      {whatsappNumber ? (
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-11 items-center justify-center rounded-base bg-pa-verde px-4 text-sm font-semibold text-white hover:bg-[#08552e]"
                        >
                          Falar no WhatsApp
                        </a>
                      ) : (
                        <LocalizedClientLink
                          href="/contato"
                          onClick={close}
                          className="flex min-h-11 items-center justify-center rounded-base bg-pa-verde px-4 text-sm font-semibold text-white hover:bg-[#08552e]"
                        >
                          Falar com a equipe
                        </LocalizedClientLink>
                      )}
                      <p className="mt-3 text-center text-xs text-ui-fg-muted">
                        © {new Date().getFullYear()} Parts Agrícola
                      </p>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
