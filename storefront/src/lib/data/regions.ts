"use server"

import { HttpTypes } from "@medusajs/types"

/**
 * Região estática. A loja é uma só (Brasil/BRL) e o Medusa — que servia isto
 * por API — saiu do ar. As funções mantêm as assinaturas do starter porque os
 * componentes só usam a região como passe-through (`region.id`).
 */
const REGIAO_BRASIL = {
  id: "br",
  name: "Brasil",
  currency_code: "brl",
  countries: [
    {
      id: "br",
      iso_2: "br",
      iso_3: "bra",
      display_name: "Brasil",
      name: "BRAZIL",
    },
  ],
} as unknown as HttpTypes.StoreRegion

export const listRegions = async (): Promise<HttpTypes.StoreRegion[]> => {
  return [REGIAO_BRASIL]
}

export const retrieveRegion = async (
  _id: string
): Promise<HttpTypes.StoreRegion> => {
  return REGIAO_BRASIL
}

export const getRegion = async (
  _countryCode: string
): Promise<HttpTypes.StoreRegion> => {
  return REGIAO_BRASIL
}
