export const PRIMARY_DEPARTMENT_HANDLES = [
  "pecas-agricolas",
  "maquinas-pesadas",
  "vedacoes-e-selagem",
  "kits-e-reparos",
] as const

export function selectPrimaryDepartments<T extends { handle: string }>(
  categories: T[]
) {
  const categoryByHandle = new Map(
    categories.map((category) => [category.handle, category])
  )

  return PRIMARY_DEPARTMENT_HANDLES.flatMap((handle) => {
    const category = categoryByHandle.get(handle)
    return category ? [category] : []
  })
}
