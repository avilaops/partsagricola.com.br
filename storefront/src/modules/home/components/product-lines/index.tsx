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
    image: "/images/departments/pecas-agricolas.webp",
    imageAlt: "Colheitadeira trabalhando em uma lavoura de grãos",
  },
  "maquinas-pesadas": {
    eyebrow: "Construção e rodante",
    accent: "#a65b16",
    surface: "bg-[#fff5e9]",
    image: "/images/departments/maquinas-pesadas.webp",
    imageAlt: "Escavadeira de esteiras em uma obra de terraplenagem",
  },
  "vedacoes-e-selagem": {
    eyebrow: "Hidráulica e industrial",
    accent: "#2857a4",
    surface: "bg-[#eef4ff]",
    image: "/images/departments/vedacoes-e-selagem.webp",
    imageAlt: "Conjunto de vedações, retentores e componentes hidráulicos",
  },
  "kits-e-reparos": {
    eyebrow: "Manutenção técnica",
    accent: "#6c3ca2",
    surface: "bg-[#f6f0fb]",
    image: "/images/departments/kits-e-reparos.webp",
    imageAlt: "Kit técnico de reparo com ferramentas e componentes de precisão",
  },
}

const ProductLines = ({
  categories,
}: {
  categories: HttpTypes.StoreProductCategory[]
}) => {
  return (
    <section className="border-b border-ui-border-base bg-white py-16 small:py-20">
      <div className="content-container">
        <div className="mb-10 flex flex-col justify-between gap-5 small:flex-row small:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0B6B3F]">
              Catálogo organizado para comprar melhor
            </p>
            <h2 className="text-3xl font-semibold tracking-tight small:text-4xl">
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

        <div className="grid grid-cols-1 gap-5 small:grid-cols-2">
          {categories.map((category) => {
            const details = DEPARTMENT_DETAILS[category.handle] || {
              eyebrow: "Catálogo técnico",
              accent: "#0B6B3F",
              surface: "bg-ui-bg-subtle",
              image: "/images/departments/pecas-agricolas.webp",
              imageAlt: "Máquinas e componentes técnicos",
            }
            const children = category.category_children || []

            return (
              <article
                key={category.id}
                className={`overflow-hidden rounded-2xl border border-ui-border-base ${details.surface}`}
              >
                <LocalizedClientLink
                  href={`/categories/${category.handle}`}
                  className="group block"
                >
                  <div className="relative h-52 overflow-hidden small:h-60">
                    <Image
                      src={details.image}
                      alt={details.imageAlt}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/10" />
                    <span className="absolute left-6 bottom-5 text-xs font-semibold uppercase tracking-[0.16em] text-white small:left-8">
                      {details.eyebrow}
                    </span>
                    <span className="absolute right-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ui-fg-base shadow-sm backdrop-blur-sm">
                      {children.length} {children.length === 1 ? "linha" : "linhas"}
                    </span>
                  </div>
                  <div className="p-6 small:p-8">
                    <h3 className="text-2xl font-semibold tracking-tight text-ui-fg-base small:text-3xl">
                      {category.name}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-ui-fg-subtle small:text-base">
                      {category.description}
                    </p>
                    <span
                      className="mt-6 inline-block text-sm font-semibold group-hover:underline"
                      style={{ color: details.accent }}
                    >
                      Explorar departamento →
                    </span>
                  </div>
                </LocalizedClientLink>

                {children.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-black/5 bg-white/60 px-6 py-4 small:px-8">
                    {children.slice(0, 7).map((child) => (
                      <LocalizedClientLink
                        key={child.id}
                        href={`/categories/${child.handle}`}
                        className="rounded-full border border-ui-border-base bg-white px-3 py-1.5 text-xs font-medium text-ui-fg-subtle transition-colors hover:border-[#0B6B3F] hover:text-[#0B6B3F]"
                      >
                        {child.name}
                      </LocalizedClientLink>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default ProductLines
