"use client"

import React from "react"
import { HttpTypes } from "@medusajs/types"

type PaymentWrapperProps = {
  cart: HttpTypes.StoreCart
  children: React.ReactNode
}

// Nenhum provedor de pagamento precisa de contexto próprio no checkout: o
// wrapper só repassa os filhos. Fica como ponto de extensão para um provedor
// futuro (Mercado Pago, Éfi ou PayPal) que precise envolver o formulário.
const PaymentWrapper: React.FC<PaymentWrapperProps> = ({ children }) => {
  return <div>{children}</div>
}

export default PaymentWrapper
