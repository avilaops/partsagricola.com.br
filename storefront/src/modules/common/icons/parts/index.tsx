import React from "react"

import { IconProps } from "types/icon"

/**
 * Ícones Parts Agrícola.
 *
 * Sistema, não coleção. O que faz 28 desenhos parecerem um conjunto é o que
 * está travado aqui no `Icon` e não se repete em cada arquivo: grade de 24,
 * traço de 1,5, ponta e junta arredondadas, `currentColor`. Desenho novo herda
 * a grade em vez de negociar com ela — é a diferença entre um sistema e uma
 * pasta com SVGs.
 *
 * A linguagem é a do desenho técnico, que a marca já usa na arte de
 * compartilhamento: construção geométrica, traço fino e uniforme, nada de
 * preenchimento. Dois traços se repetem de propósito e são a assinatura do
 * conjunto:
 *
 *   - a **cota** — as linhas de extensão com seta que marcam uma medida numa
 *     prancha. Aparecem onde a ação é medir ou conferir dimensão, que é a
 *     função que separa este catálogo de uma loja qualquer.
 *   - o **dente de engrenagem**, eco do símbolo da marca, nos ícones que falam
 *     de máquina, aplicação e garantia.
 *
 * Grade de 24 e não de 20 (a dos ícones herdados do starter) porque cota e
 * dente precisam de espaço para não virar borrão em 16px. `size` continua
 * aceitando 20 — o SVG escala.
 */

const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = "24",
  color = "currentColor",
  children,
  ...attributes
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...attributes}
  >
    {children}
  </svg>
)

/* ---------------------------------------------------------------- busca --- */

/** Busca por código: a lupa sobre o campo alfanumérico da etiqueta. */
export const BuscarPorCodigo: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="2.75" y="5.75" width="12.5" height="8.5" rx="1.5" />
    <path d="M5.5 8.5v3M7.75 8.5v3M10 8.5v3M12.5 8.5v3" />
    <circle cx="16.5" cy="16.5" r="4" />
    <path d="M19.4 19.4 21.5 21.5" />
  </Icon>
)

/** Busca por nome: a lupa sobre linhas de texto. */
export const BuscarPorNome: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M3 6.5h12M3 10h8.5M3 13.5h5" />
    <circle cx="16.5" cy="16.5" r="4" />
    <path d="M19.4 19.4 21.5 21.5" />
  </Icon>
)

/** Busca por aplicação: a lupa sobre a máquina em que a peça entra. */
export const BuscarPorAplicacao: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="9.5" r="3" />
    <path d="M10 3.5v1.6M10 13.9v1.6M15.5 9.5h-1.6M6.1 9.5H4.5M13.9 5.6l-1.1 1.1M7.2 12.3l-1.1 1.1M13.9 13.4l-1.1-1.1M7.2 6.7 6.1 5.6" />
    <circle cx="17" cy="17" r="3.5" />
    <path d="M19.5 19.5 21.5 21.5" />
  </Icon>
)

/** Filtro: o funil com os trilhos de ajuste do painel lateral. */
export const Filtro: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M3.5 4.5h17l-6.5 7.6v6.4l-4 2.5v-8.9L3.5 4.5Z" />
  </Icon>
)

/* -------------------------------------------------------------- técnico --- */

/**
 * Compatibilidade: eixo e alojamento com a cota entre eles.
 * O que se confere numa peça de vedação é se a medida fecha, não se o desenho
 * combina — por isso a cota e não dois encaixes de quebra-cabeça.
 */
export const Compatibilidade: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M4 4.5v15M20 4.5v15" />
    <path d="M6.5 12h11" />
    <path d="M8.5 9.75 6.5 12l2 2.25M15.5 9.75 17.5 12l-2 2.25" />
    <path d="M4 7.5h1.5M18.5 7.5H20M4 16.5h1.5M18.5 16.5H20" />
  </Icon>
)

/**
 * Confirmação técnica: o paquímetro com a marca de conferido.
 * É o ícone-assinatura do conjunto — a etapa que o negócio vende.
 */
export const ConfirmacaoTecnica: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M3.5 5.5h13M3.5 5.5v4M16.5 5.5v4" />
    <path d="M7.5 5.5v6.5M7.5 12h3" />
    <path d="M12.5 14.5l2.5 2.5 5.5-5.5" />
  </Icon>
)

/** Máquina: rodado e chassi, o perfil que o cliente reconhece na lavoura. */
export const Maquina: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx="6.5" cy="16.5" r="3.5" />
    <circle cx="17" cy="17.5" r="2.5" />
    <path d="M6.5 13V9.5h5l1.5 4.5h4.5V15" />
    <path d="M11.5 9.5V6.5h-3" />
    <path d="M10 16.5h4.5" />
  </Icon>
)

/** Marca: etiqueta com o furo de fixação. */
export const Marca: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M11.4 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.6a1.5 1.5 0 0 1-.44 1.06l-6.9 6.9a1.5 1.5 0 0 1-2.12 0l-7.6-7.6a1.5 1.5 0 0 1 0-2.12l6.9-6.9a1.5 1.5 0 0 1 1.06-.44Z" />
    <circle cx="16" cy="8" r="1.5" />
  </Icon>
)

/** Categoria: a grade da taxonomia. */
export const Categoria: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.25" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.25" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.25" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.25" />
  </Icon>
)

/* ---------------------------------------------------------------- loja --- */

export const Carrinho: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M2.5 3.5h2.2l2.1 11a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.47-1.18L20 7.5H5.3" />
    <circle cx="9.5" cy="20" r="1.25" />
    <circle cx="17.5" cy="20" r="1.25" />
  </Icon>
)

/** Favoritos: marcador de página, não coração — catálogo técnico se guarda. */
export const Favoritos: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M6 3.5h12v17l-6-4.2-6 4.2v-17Z" />
  </Icon>
)

/** Comparar: duas fichas lado a lado e a diferença marcada entre elas. */
export const Compararprodutos: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="7.5" height="15" rx="1.25" />
    <rect x="14" y="4.5" width="7.5" height="15" rx="1.25" />
    <path d="M10.75 9.5h2.5M10.75 14.5h2.5" />
    <path d="M12.25 8.25 13.5 9.5l-1.25 1.25M11.75 13.25 10.5 14.5l1.25 1.25" />
  </Icon>
)

/* -------------------------------------------------------------- pedido --- */

export const Pedido: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M5.5 2.5h9l5 5v14h-14v-19Z" />
    <path d="M14.5 2.5v5h5" />
    <path d="M8.5 12.5h7M8.5 16h4.5" />
  </Icon>
)

export const Entrega: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M2.5 6.5h10v10H2.5z" />
    <path d="M12.5 10h4l3 3v3.5h-7" />
    <circle cx="7" cy="18.5" r="2" />
    <circle cx="17" cy="18.5" r="2" />
    <path d="M9 18.5h6" />
  </Icon>
)

/** Retirada: o balcão e a peça já separada em cima. */
export const Retirada: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M3 8.5 4.5 4h15L21 8.5" />
    <path d="M3 8.5h18M4.5 8.5V20h15V8.5" />
    <path d="M9.5 13.5h5v3.5h-5z" />
  </Icon>
)

export const Pagamento: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
    <path d="M2.5 10h19" />
    <path d="M6 14.5h3.5" />
  </Icon>
)

/** Pix: o losango de quatro pontas do arranjo de pagamento. */
export const Pix: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M8.4 4.9 6.6 6.7a1.6 1.6 0 0 0 0 2.3L9 11.4a.9.9 0 0 1 0 1.2L6.6 15a1.6 1.6 0 0 0 0 2.3l1.8 1.8" />
    <path d="M15.6 4.9l1.8 1.8a1.6 1.6 0 0 1 0 2.3L15 11.4a.9.9 0 0 0 0 1.2L17.4 15a1.6 1.6 0 0 1 0 2.3l-1.8 1.8" />
    <path d="M9.6 3.7a1.6 1.6 0 0 1 2.3 0l2.1 2.1a1.6 1.6 0 0 1-2.3 2.3L9.6 6a1.6 1.6 0 0 1 0-2.3Z" />
    <path d="M9.6 20.3a1.6 1.6 0 0 0 2.3 0l2.1-2.1a1.6 1.6 0 0 0-2.3-2.3L9.6 18a1.6 1.6 0 0 0 0 2.3Z" />
  </Icon>
)

export const Cartao: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 9.5h19" />
    <path d="M6 15h4M13.5 15h4.5" />
  </Icon>
)

/* ---------------------------------------------------------- atendimento --- */

export const WhatsApp: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M20.5 11.7a8.4 8.4 0 0 1-12.5 7.3L3.5 20.5l1.6-4.4A8.4 8.4 0 1 1 20.5 11.7Z" />
    <path d="M9 8.6c.3-.1.6 0 .8.3l.8 1.3c.2.3.1.6-.1.8l-.5.5a5.6 5.6 0 0 0 2.5 2.5l.5-.5c.2-.2.5-.3.8-.1l1.3.8c.3.2.4.5.3.8-.3.8-1.1 1.3-2 1.2-2.9-.3-5.5-2.9-5.8-5.8-.1-.9.4-1.7 1.2-2Z" />
  </Icon>
)

export const Atendimento: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M4.5 14.5v-2.5a7.5 7.5 0 0 1 15 0v2.5" />
    <path d="M4.5 13h1.5a1.5 1.5 0 0 1 1.5 1.5v2.5a1.5 1.5 0 0 1-1.5 1.5H4.5a1 1 0 0 1-1-1v-3.5a1 1 0 0 1 1-1Z" />
    <path d="M19.5 13h-1.5a1.5 1.5 0 0 0-1.5 1.5v2.5a1.5 1.5 0 0 0 1.5 1.5h1.5a1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1Z" />
    <path d="M19.5 18.5v.5a2.5 2.5 0 0 1-2.5 2.5h-2.5" />
  </Icon>
)

/* -------------------------------------------------------------- selos --- */

/** Vendedor verificado: o escudo com a pessoa e a marca de conferido. */
export const VendedorVerificado: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M12 2.5 20 5.5v6.2c0 4.5-3.2 8.2-8 9.8-4.8-1.6-8-5.3-8-9.8V5.5l8-3Z" />
    <circle cx="12" cy="10" r="2.25" />
    <path d="M8.25 16.25a4 4 0 0 1 7.5 0" />
  </Icon>
)

/** Produto conferido: a caixa com a marca de conferência. */
export const ProdutoConferido: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M20.5 11V6.9L12 3 3.5 6.9v9.2L12 20l2.5-1.1" />
    <path d="M3.5 6.9 12 10.8l8.5-3.9M12 10.8V20" />
    <path d="M15.5 17.5 17.5 19.5 21.5 15.5" />
  </Icon>
)

/** Estoque disponível: as caixas empilhadas e o nível preenchido. */
export const EstoqueDisponivel: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="12.5" width="7.5" height="7.5" rx="1" />
    <rect x="13" y="12.5" width="7.5" height="7.5" rx="1" />
    <rect x="8.25" y="4" width="7.5" height="7" rx="1" />
    <path d="M6 16.25h2.5M15.5 16.25H18M10.75 7.5h2.5" />
  </Icon>
)

/** Sob encomenda: a caixa com o prazo. */
export const SobEncomenda: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M20.5 10.5V6.9L12 3 3.5 6.9v9.2L12 20l1.5-.7" />
    <path d="M3.5 6.9 12 10.8l8.5-3.9M12 10.8V20" />
    <circle cx="17.5" cy="16.5" r="4" />
    <path d="M17.5 14.5v2l1.4 1" />
  </Icon>
)

export const Oferta: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M11.4 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.6a1.5 1.5 0 0 1-.44 1.06l-6.9 6.9a1.5 1.5 0 0 1-2.12 0l-7.6-7.6a1.5 1.5 0 0 1 0-2.12l6.9-6.9a1.5 1.5 0 0 1 1.06-.44Z" />
    <path d="M8.75 9.25 12.5 13" />
    <circle cx="8.5" cy="12.5" r="1.1" />
    <circle cx="12.75" cy="8.5" r="1.1" />
  </Icon>
)

/** Novo produto: a peça e o brilho de recém-chegado. */
export const NovoProduto: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M19 12.2v3.9L11.5 20 4 16.1V7.9L11.5 4l3.5 1.8" />
    <path d="M4 7.9l7.5 3.9L19 7.9M11.5 11.8V20" />
    <path d="M18.5 2.5v4M16.5 4.5h4" />
  </Icon>
)

/** Garantia: o escudo com o dente de engrenagem — o eco do símbolo. */
export const Garantia: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M12 2.5 20 5.5v6.2c0 4.5-3.2 8.2-8 9.8-4.8-1.6-8-5.3-8-9.8V5.5l8-3Z" />
    <circle cx="12" cy="11" r="2.5" />
    <path d="M12 6.5v1.4M12 14.1v1.4M16.5 11h-1.4M8.9 11H7.5M15.2 7.8l-1 1M9.8 13.2l-1 1M15.2 14.2l-1-1M9.8 8.8l-1-1" />
  </Icon>
)

export const Devolucao: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M20.5 12V6.9L12 3 3.5 6.9V12" />
    <path d="M3.5 6.9 12 10.8l8.5-3.9M12 10.8v4.7" />
    <path d="M4 19h11.5a3.5 3.5 0 0 0 0-7H8" />
    <path d="M6.5 16.5 4 19l2.5 2.5" />
  </Icon>
)
