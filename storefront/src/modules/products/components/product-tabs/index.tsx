"use client"

import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"
import { getTechnicalAttributes } from "@lib/util/product-technical"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const tabs = [
    {
      label: "Ficha técnica",
      component: <ProductInfoTab product={product} />,
    },
    {
      label: "Atendimento e entrega",
      component: <ShippingInfoTab />,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple">
        {tabs.map((tab, i) => (
          <Accordion.Item
            key={i}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const ProductInfoTab = ({ product }: ProductTabsProps) => {
  const attributes = getTechnicalAttributes(product)

  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-1 gap-4 xsmall:grid-cols-2">
        {attributes.map((attribute) => (
          <div key={attribute.label}>
            <span className="font-semibold">{attribute.label}</span>
            <p className="mt-1 text-ui-fg-subtle">{attribute.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const ShippingInfoTab = () => {
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-1 gap-y-8">
        <div className="flex items-start gap-x-2">
          <FastDelivery />
          <div>
            <span className="font-semibold">Prazo confirmado na cotação</span>
            <p className="max-w-sm">
              Disponibilidade, prazo de separação e transporte são informados
              antes do fechamento.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Refresh />
          <div>
            <span className="font-semibold">Validação de aplicação</span>
            <p className="max-w-sm">
              Envie o código e os dados da máquina para nossa equipe confirmar
              a compatibilidade.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Back />
          <div>
            <span className="font-semibold">Condição comercial transparente</span>
            <p className="max-w-sm">
              Preço, pagamento, frete e política aplicável seguem registrados
              na proposta enviada para você.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
