"use client"

import { useEffect, useState } from "react"

import { formatLeadOrigin, getLeadOrigin } from "@lib/util/analytics"

/**
 * Sufixo de origem pra colar no fim da mensagem de cotacao.
 *
 * Comeca vazio e so preenche depois de montar: a origem vive no
 * `sessionStorage`, que nao existe no servidor. Ler direto na renderizacao
 * daria HTML diferente no servidor e no cliente, e o React descartaria a
 * arvore inteira por mismatch de hidratacao.
 *
 * O efeito colateral e que o href muda depois da hidratacao — invisivel pro
 * usuario, porque o que muda e o corpo do e-mail, nao o texto do botao.
 */
export function useLeadOrigin() {
  const [sufixo, setSufixo] = useState("")

  useEffect(() => {
    setSufixo(formatLeadOrigin(getLeadOrigin()))
  }, [])

  return sufixo
}
