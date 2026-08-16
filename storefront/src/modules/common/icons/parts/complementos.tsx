import React from "react"

import { IconProps } from "types/icon"

/**
 * Complementos ao kit oficial.
 *
 * O sprite da marca cobre os 28 ícones de catálogo e de operação. Estes quatro
 * são de mecânica de interface — fechar um painel, marcar um item, listar o que
 * já foi buscado — e a interface já os desenhava à mão em cada arquivo, com
 * traço 1,6, 1,7, 1,8 ou 2 conforme o dia.
 *
 * Ficam num arquivo separado de propósito: `index.tsx` é gerado por
 * `scripts/gerar-icones.mjs` e é sobrescrito a cada atualização do sprite.
 * Se algum destes entrar no kit oficial, apague daqui e reexporte de lá.
 *
 * Mesma especificação do kit: grade 24×24, traço 1,8, terminais arredondados.
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
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...attributes}
  >
    {children}
  </svg>
)

/**
 * Lista de cotação — o que o cliente junta para perguntar agora.
 * É outra coisa de `Favorites`, que é o que ele guarda para depois.
 */
export const QuoteList: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v15.5l-7-3.2-7 3.2V5a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M9 8h6M9 11.5h4" />
  </Icon>
)

export const Close: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
)

export const Check: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)

/** Buscas recentes. */
export const Recent: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)
