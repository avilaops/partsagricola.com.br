import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import CategoryTemplate from "@modules/categories/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

type Props = {
  params: Promise<{ category: string[]; countryCode: string }>
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
  }>
}

export async function generateStaticParams() {
  // Sem alcance ao Postgres no build, as 74 páginas nascem sob demanda (ISR).
  try {
    const product_categories = await listCategories()
    return product_categories.map((category: any) => ({
      countryCode: "br",
      category: [category.handle],
    }))
  } catch {
    return []
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  try {
    const productCategory = await getCategoryByHandle(params.category)
    if (!productCategory) {
      notFound()
    }

    const title = productCategory.name

    const description =
      productCategory.description ?? `Peças da categoria ${title}.`

    return {
      title,
      description,
      alternates: {
        canonical: `/${params.countryCode}/categories/${params.category.join(
          "/"
        )}`,
      },
    }
  } catch (error) {
    notFound()
  }
}

export default async function CategoryPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { sortBy, page } = searchParams

  const productCategory = await getCategoryByHandle(params.category)

  if (!productCategory) {
    notFound()
  }

  return (
    <CategoryTemplate
      category={productCategory}
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
    />
  )
}
