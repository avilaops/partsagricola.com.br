import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

const DEPARTMENT_DETAILS: Record<
  string,
  {
    eyebrow: string
    accent: string
    surface: string
    image: string
    imageAlt: string
  }
> = {
  "pecas-agricolas": {
    eyebrow: "Plantio e colheita",
    accent: "#0B6B3F",
    surface: "bg-[#eef7f1]",
    image: "/images/departments/pecas-agricolas-v2.webp",
    imageAlt:
      "Engrenagem, rolamentos, filtros e componentes para máquinas agrícolas",
  },
  "maquinas-pesadas": {
    eyebrow: "Construção e rodante",
    accent: "#a65b16",
    surface: "bg-[#fff5e9]",
    image: "/images/departments/maquinas-pesadas-v2.webp",
    imageAlt:
      "Conjunto de esteira, roda motriz e cilindro hidráulico de máquina pesada",
  },
  "vedacoes-e-selagem": {
    eyebrow: "Hidráulica e industrial",
    accent: "#2857a4",
    surface: "bg-[#eef4ff]",
    image: "/images/departments/vedacoes-e-selagem-v2.webp",
    imageAlt: "Conjunto de vedações, retentores e componentes hidráulicos",
  },
  "kits-e-reparos": {
    eyebrow: "Manutenção técnica",
    accent: "#6c3ca2",
    surface: "bg-[#f6f0fb]",
    image: "/images/departments/kits-e-reparos.webp",
    imageAlt: "Kit técnico de reparo com ferramentas e componentes de precisão",
  },
  "rolamentos-e-transmissao": {
    eyebrow: "Rolamentos e transmissão",
    accent: "#8a1c1c",
    surface: "bg-[#fdf0f0]",
    image: "/images/departments/rolamentos-e-transmissao.webp",
    imageAlt: "Rolamento de esferas, mancal e correia de transmissão",
  },
}

const ProductLines = ({
  categories,
  totais = {},
}: {
  categories: HttpTypes.StoreProductCategory[]
  /** handle → peças publicadas (subárvore inteira) */
  totais?: Record<string, number>
}) => {
  return (
    <section className="border-b border-ui-border-base bg-white py-12 small:py-16">
      <div className="content-container">
        <div className="mb-8 flex flex-col justify-between gap-4 small:flex-row small:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0B6B3F]">
              Catálogo organizado para comprar melhor
            </p>
            <h2 className="text-2xl font-semibold tracking-tight small:text-4xl">
              Encontre pela máquina, sistema ou aplicação
            </h2>
            <p className="mt-3 text-base text-ui-fg-subtle">
              Comece por um departamento e refine até chegar à peça correta.
            </p>
          </div>
          <LocalizedClientLink
            href="/store"
            className="font-medium text-[#0B6B3F] hover:underline"
          >
            Ver catálogo completo →
          </LocalizedClientLink>
        </div>

        <div className="grid grid-cols-2 gap-3 small:gap-5 medium:grid-cols-3 large:grid-cols-5">
          {categories.map((category) => {
            const details = DEPARTMENT_DETAILS[category.handle] || {
              eyebrow: "Catálogo técnico",
              accent: "#0B6B3F",
              surface: "bg-ui-bg-subtle",
              image: "/images/departments/pecas-agricolas.webp",
              imageAlt: "Máquinas e componentes técnicos",
            }
            const children = category.category_children || []
            const total = totais[category.handle] ?? 0

            return (
              <article
                key={category.id}
                className={`overflow-hidden rounded-2xl border border-ui-border-base ${details.surface}`}
              >
                <LocalizedClientLink
                  href={`/categories/${category.handle}`}
                  className="group block"
                >
                  <div className="relative h-32 overflow-hidden small:h-40 medium:h-44">
                    <Image
                      src={details.image}
                      alt={details.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover object-right transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/10" />
                    <span className="absolute bottom-4 left-4 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-white small:block">
                      {details.eyebrow}
                    </span>
                    <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-ui-fg-base shadow-sm backdrop-blur-sm">
                      {total > 0
                        ? `${total.toLocaleString("pt-BR")} peças · `
                        : ""}
                      {children.length}{" "}
                      {children.length === 1 ? "linha" : "linhas"}
                    </span>
                  </div>
                  <div className="p-4 small:p-5">
                    <h3 className="text-lg font-semibold leading-tight tracking-tight text-ui-fg-base small:text-xl">
                      {category.name}
                    </h3>
                    <p className="mt-2 hidden text-sm leading-relaxed text-ui-fg-subtle medium:line-clamp-3 medium:block">
                      {category.description}
                    </p>
                    <span
                      className="mt-3 inline-block text-xs font-semibold group-hover:underline small:text-sm"
                      style={{ color: details.accent }}
                    >
                      Explorar →
                    </span>
                  </div>
                </LocalizedClientLink>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default ProductLines
