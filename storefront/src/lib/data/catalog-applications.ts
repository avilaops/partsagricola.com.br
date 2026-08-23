export type CatalogApplication = {
  handle: string
  name: string
  description: string
}

export const CATALOG_APPLICATIONS: CatalogApplication[] = [
  {
    handle: "john-deere",
    name: "John Deere",
    description:
      "Peças para tratores, colhedoras, plantadeiras e máquinas John Deere, pesquisáveis por código e aplicação.",
  },
  {
    handle: "case",
    name: "Case",
    description:
      "Peças compatíveis com máquinas agrícolas e equipamentos pesados Case, organizadas para consulta técnica.",
  },
  {
    handle: "caterpillar",
    name: "Caterpillar",
    description:
      "Componentes para máquinas pesadas Caterpillar, incluindo construção, terraplenagem e material rodante.",
  },
  {
    handle: "new-holland",
    name: "New Holland",
    description:
      "Peças para tratores, colheitadeiras e máquinas New Holland com busca por nome, código e aplicação.",
  },
  {
    handle: "fiatallis",
    name: "Fiatallis",
    description:
      "Componentes compatíveis com equipamentos Fiatallis para manutenção de máquinas e conjuntos mecânicos.",
  },
  {
    handle: "massey-ferguson",
    name: "Massey Ferguson",
    description:
      "Peças para tratores e máquinas Massey Ferguson, com referências técnicas para facilitar a identificação.",
  },
  {
    handle: "komatsu",
    name: "Komatsu",
    description:
      "Peças compatíveis com máquinas pesadas Komatsu para construção, mineração e movimentação de solo.",
  },
  {
    handle: "valtra",
    name: "Valtra",
    description:
      "Peças para tratores e equipamentos agrícolas Valtra, pesquisáveis por código, descrição e aplicação.",
  },
]

export const getCatalogApplication = (handle: string) =>
  CATALOG_APPLICATIONS.find((application) => application.handle === handle)

/** "Massey Ferguson" → "massey-ferguson"; a mesma regra das oito curadas. */
export const slugAplicacao = (nome: string) =>
  nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
