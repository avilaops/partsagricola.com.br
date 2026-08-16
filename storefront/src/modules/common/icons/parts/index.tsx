// ARQUIVO GERADO por scripts/gerar-icones.mjs — não edite manualmente.
// Fonte: public/assets/partsagricola-icons.svg (kit oficial da marca).
// Para atualizar: troque o sprite e rode `npm run icones`.
import React from "react"

import { IconProps } from "types/icon"

/**
 * Ícones Parts Agrícola.
 *
 * Grade 24×24, traço 1,8, terminais arredondados, cor de `currentColor` e
 * detalhes de destaque em `--pa-green` (fallback `#0B6B3F`), conforme o kit.
 *
 * As classes `.pa-accent` e `.pa-fill-accent` vêm do sprite e estão definidas
 * em `styles/globals.css` — é por elas que o verde de destaque continua
 * sobreponível por `--pa-green`.
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
    color={color}
    xmlns="http://www.w3.org/2000/svg"
    {...attributes}
  >
    {children}
  </svg>
)

/** `pa-search-code` */
export const SearchCode: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m16 16 4.2 4.2" />
    <path d="M8 8.5h4.5M8 10.8h5M8 13.1h3.5" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M8 8.5h4.5" />
  </Icon>
)

/** `pa-search-name` */
export const SearchName: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m16 16 4.2 4.2" />
    <path d="m8 13.5 2.1-5 2.1 5M8.8 11.6h2.6" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M8.8 11.6h2.6" />
  </Icon>
)

/** `pa-search-application` */
export const SearchApplication: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m16 16 4.2 4.2" />
    <path d="M7.5 12.5h6v-3h-4l-1 1.5h-1zM9 12.5v1.5M12.5 12.5v1.5" />
    <circle cx="9" cy="14.2" r=".7" />
    <circle cx="12.5" cy="14.2" r=".7" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M7.5 12.5h6" />
  </Icon>
)

/** `pa-filter` */
export const Filter: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h16l-6.2 7.2v5.1l-3.6 1.8v-6.9z" />
    </g>
    <circle className="pa-fill-accent" cx="17.5" cy="17.5" r="2.2" />
  </Icon>
)

/** `pa-compatibility` */
export const Compatibility: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9.2 14.8-1.5 1.5a3.6 3.6 0 0 1-5.1-5.1l2.1-2.1a3.6 3.6 0 0 1 5.1 0" />
    <path d="m14.8 9.2 1.5-1.5a3.6 3.6 0 0 1 5.1 5.1l-2.1 2.1a3.6 3.6 0 0 1-5.1 0" />
    <path d="m8.5 15.5 7-7" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="m14.5 17.4 1.7 1.7 3.4-3.4" />
  </Icon>
)

/** `pa-machine` */
export const Machine: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9.5" cy="12" r="5.3" />
    <path d="M9.5 3.5v2M9.5 18.5v2M1 12h2M16 12h2M3.5 6l1.4 1.4M14.1 16.6l1.4 1.4M3.5 18l1.4-1.4M14.1 7.4l1.4-1.4" />
    <path d="M15 7.5c2.7-.3 4.8.8 5.5 3.4-2.8.6-4.8-.5-5.5-3.4z" />
    <path d="M15 7.5c-.2 2.2.7 3.7 2.6 4.7" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M15 7.5c-.2 2.2.7 3.7 2.6 4.7" />
  </Icon>
)

/** `pa-brand` */
export const Brand: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10" />
    <path d="M8.7 7.2c.7-2.3 3.2-2.7 4.6-.9.6.8.8 1.6.5 2.4-2.2.2-4-.3-5.1-1.5z" />
    <path d="M9 7.3c1.1 1.1 2.2 1.5 3.8 1.4" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M9 7.3c1.1 1.1 2.2 1.5 3.8 1.4" />
  </Icon>
)

/** `pa-category` */
export const Category: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
    </g>
    <rect className="pa-fill-accent" x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
  </Icon>
)

/** `pa-cart` */
export const Cart: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 4.5h2l1.7 10.2h10.7l2-7.3H6.2" />
    <path d="M9 18.5h7.4" />
    <circle cx="9" cy="20" r="1" />
    <circle cx="17.5" cy="20" r="1" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M8.5 11h8.4" />
  </Icon>
)

/** `pa-favorites` */
export const Favorites: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19.6S4.5 15.2 4.5 9.3A4 4 0 0 1 12 7.2a4 4 0 0 1 7.5 2.1c0 5.9-7.5 10.3-7.5 10.3z" />
    <path d="M13.8 14.4c.1-2.3 1.7-3.5 4-3.2-.2 2.4-1.6 3.5-4 3.2z" />
    <path d="M13.8 14.4c.8-.3 1.4-.8 1.9-1.6" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M13.8 14.4c.8-.3 1.4-.8 1.9-1.6" />
  </Icon>
)

/** `pa-compare` */
export const Compare: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="7.5" height="12" rx="1.2" />
    <rect x="13" y="7" width="7.5" height="12" rx="1.2" />
    <path d="M6 9h2.5M6 12h2.5M15.5 11h2.5M15.5 14h2.5" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M10.2 18.5h3.6" />
  </Icon>
)

/** `pa-order` */
export const Order: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3.5h9l3 3v14H6zM15 3.5v3h3" />
    <path d="M9 10h5M9 13h3" />
    <circle cx="16.2" cy="16.5" r="2.3" />
    <path d="m16.2 13.5.5 1M18.3 15l.9.4M18.2 17.7l.7.8M14.2 17.7l-.7.8M14.1 15l-.9.4" />
    </g>
    <circle className="pa-fill-accent" cx="16.2" cy="16.5" r=".7" />
  </Icon>
)

/** `pa-delivery` */
export const Delivery: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 6h10v10h-10zM13.5 10h4l3 3v3h-7z" />
    <path d="M16 10v3h4" />
    <circle cx="7" cy="18" r="1.5" />
    <circle cx="17.5" cy="18" r="1.5" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M4 8.5h7" />
  </Icon>
)

/** `pa-pickup` */
export const Pickup: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20.5s6-5.5 6-10A6 6 0 0 0 6 10.5c0 4.5 6 10 6 10z" />
    <circle cx="12" cy="10.5" r="2" />
    <path d="M4 20h16" />
    <path d="M7 17.5h10" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M9 20h6" />
  </Icon>
)

/** `pa-payment` */
export const Payment: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8.5h16v10H4zM6.5 8.5V6.8A2.8 2.8 0 0 1 9.3 4h7.2" />
    <path d="M4 11.5h16M15 15h2.5" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M7 15h3" />
  </Icon>
)

/** `pa-pix` */
export const Pix: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m8.5 5 3.5 3.5L15.5 5M5 8.5 8.5 12 5 15.5M19 8.5 15.5 12l3.5 3.5M8.5 19l3.5-3.5 3.5 3.5" />
    <path d="m8.5 5 3.5 3.5L15.5 5M8.5 19l3.5-3.5 3.5 3.5" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M8.5 12h7" />
  </Icon>
)

/** `pa-card` */
export const Card: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3 9.5h18M7 13h3M7 16h5" />
    <rect x="15.2" y="12" width="3" height="2.4" rx=".4" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M3 9.5h18" />
  </Icon>
)

/** `pa-whatsapp` */
export const Whatsapp: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4.5a7.5 7.5 0 0 0-6.5 11.3L4.5 19.5l3.9-1a7.5 7.5 0 1 0 3.6-14z" />
    <path d="M9.2 8.8c.3-.5.7-.4 1-.2l.8 1.2c.2.3.1.6-.1.8l-.5.5c.5 1 1.2 1.7 2.2 2.2l.5-.5c.2-.2.5-.3.8-.1l1.2.8c.3.2.3.7-.2 1-.5.4-1.1.5-1.7.3-2.7-.9-4.8-3-5.7-5.7-.2-.6-.1-1.2.3-1.7z" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M4.5 19.5 7 18.8" />
  </Icon>
)

/** `pa-support` */
export const Support: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13v-1a7 7 0 0 1 14 0v1M5 13H3.8v4H7v-4M19 13h1.2v4H17v-4M17 17c0 2-1.5 3-4 3" />
    <path d="M13.8 7.5c2.2-.1 3.5 1.1 3.7 3.1-2 .3-3.3-.8-3.7-3.1zM13.8 7.5c-.1 1.5.4 2.5 1.5 3.1" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M13.8 7.5c-.1 1.5.4 2.5 1.5 3.1" />
  </Icon>
)

/** `pa-verified-seller` */
export const VerifiedSeller: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 10 12 4l8.5 6v9.5h-17zM3.5 10h17M7 19.5v-5h10v5M9 10v2M12 10v2M15 10v2" />
    <path d="m17.2 15.8 1.1 1.1 2.2-2.2" />
    </g>
    <circle className="pa-fill-accent" cx="19.2" cy="15.8" r="2.8" />
    <path fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" d="m17.9 15.8 1 1 2-2" />
  </Icon>
)

/** `pa-checked-product` */
export const CheckedProduct: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 8 8-4 8 4-8 4zM4 8v9l8 4 8-4V8M12 12v9" />
    <path d="m14.5 16.5 1.5 1.5 3.2-3.2" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m14.5 16.5 1.5 1.5 3.2-3.2" />
  </Icon>
)

/** `pa-technical-confirmation` */
export const TechnicalConfirmation: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9.5" cy="9.5" r="5.5" />
    <path d="m13.5 13.5 5.5 5.5M7.5 9.5h4M9.5 7.5v4" />
    <path d="m17.2 4.5.7 1.2 1.3.3-.9 1 .1 1.4-1.2-.6-1.2.6.1-1.4-.9-1 1.3-.3z" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="m17.2 4.5.7 1.2 1.3.3" />
  </Icon>
)

/** `pa-stock-available` */
export const StockAvailable: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9h6v10H4zM14 5h6v14h-6zM4 9l3-2 3 2M14 5l3-2 3 2" />
    <path d="M5.8 15.5h2.5M15.8 12h2.5M15.8 15h2.5" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M15.8 15h2.5" />
  </Icon>
)

/** `pa-made-to-order` */
export const MadeToOrder: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="12" r="5.3" />
    <path d="M9 8.8v3.6l2.2 1.4M9 3.5v1.2M9 19.3v1.2M3 12H2M16 12h-1M4.8 7.8 4 7M14 17l-.8-.8M4.8 16.2 4 17M14 7l-.8.8" />
    <circle cx="17.5" cy="16.5" r="3.2" />
    <path d="M17.5 14.8v1.9l1.2.7" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M17.5 14.8v1.9" />
  </Icon>
)

/** `pa-offer` */
export const Offer: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 6 5-2 10 10-7 7L2 11zM6.5 7.5h.1" />
    <path d="m9 15 5-5M9.5 10.5h.1M13.5 14.5h.1" />
    </g>
    <circle className="pa-fill-accent" cx="6.5" cy="7.5" r="1.1" />
  </Icon>
)

/** `pa-new-product` */
export const NewProduct: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 8 8-4 8 4-8 4zM4 8v9l8 4 8-4V8M12 12v9" />
    <path d="M18.5 3v3M17 4.5h3" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M18.5 3v3M17 4.5h3" />
  </Icon>
)

/** `pa-warranty` */
export const Warranty: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3.5 19 6v5.2c0 4.5-2.7 7.6-7 9.3-4.3-1.7-7-4.8-7-9.3V6z" />
    <path d="m8.5 12 2.2 2.2 4.8-4.8" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m8.5 12 2.2 2.2 4.8-4.8" />
  </Icon>
)

/** `pa-return` */
export const Return: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 8 7-3.5L19 8v8l-7 3.5L5 16zM5 8l7 3.5L19 8M12 11.5v8" />
    <path d="M4 4v4h4M4 8a7.5 7.5 0 0 1 13.3-4.8" />
    </g>
    <path className="pa-accent" fill="none" strokeWidth="1.8" strokeLinecap="round" d="M4 4v4h4" />
  </Icon>
)
