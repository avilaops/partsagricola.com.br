// Converte o sprite oficial (public/assets/partsagricola-icons.svg) nos
// componentes React de src/modules/common/icons/parts/index.tsx.
//
// Por que gerar componente em vez de usar `<use href="/assets/....svg#id">`,
// que e o que o README do kit sugere:
//
// `<use>` apontando para OUTRO arquivo cria uma fronteira de documento. O
// `currentColor` e as custom properties da pagina nao atravessam essa fronteira
// no Firefox nem no Safari — o conteudo referenciado e estilizado pelo proprio
// documento do sprite, nao pelo que o referencia. Na pratica o icone ficaria
// preso a cor de fallback em vez de seguir a cor do texto, e o `--pa-green` que
// o README manda definir no `.pa-icon` nunca chegaria la dentro.
//
// Inlinando a geometria em componente, `currentColor` e `--pa-green` funcionam
// em todo browser, o icone entra no bundle sem uma requisicao extra e o nome
// vira erro de compilacao quando nao existe.
//
// O sprite continua publicado em /assets/ — serve e-mail, PDF e qualquer
// consumidor que nao seja este React.
//
// Uso: node scripts/gerar-icones.mjs
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SPRITE = path.join(RAIZ, "public", "assets", "partsagricola-icons.svg")
const SAIDA = path.join(RAIZ, "src", "modules", "common", "icons", "parts", "index.tsx")

const ATRIBUTOS = {
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray",
  "stroke-miterlimit": "strokeMiterlimit",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "fill-opacity": "fillOpacity",
  "stroke-opacity": "strokeOpacity",
  class: "className",
}

function paraJsx(markup) {
  let jsx = markup
  for (const [de, para] of Object.entries(ATRIBUTOS)) {
    jsx = jsx.replaceAll(new RegExp(`\\b${de}=`, "g"), `${para}=`)
  }
  // `<path ... >` sem barra vira erro em JSX.
  return jsx.replace(/<(circle|path|rect|line|polyline|polygon|ellipse)([^>]*?)\s*\/?>/g, "<$1$2 />")
}

/** pa-search-code -> SearchCode */
function paraNome(id) {
  return id
    .replace(/^pa-/, "")
    .split("-")
    .map((parte) => parte[0].toUpperCase() + parte.slice(1))
    .join("")
}

const sprite = readFileSync(SPRITE, "utf8")
const simbolos = [...sprite.matchAll(/<symbol id="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g)]

if (!simbolos.length) {
  throw new Error(`Nenhum <symbol> encontrado em ${SPRITE}.`)
}

const componentes = simbolos.map(([, id, corpo]) => {
  const conteudo = paraJsx(corpo.trim())
    .split("\n")
    .map((linha) => "    " + linha.trim())
    .filter((linha) => linha.trim())
    .join("\n")
  return `/** \`${id}\` */\nexport const ${paraNome(id)}: React.FC<IconProps> = (p) => (\n  <Icon {...p}>\n${conteudo}\n  </Icon>\n)`
})

const arquivo = `// ARQUIVO GERADO por scripts/gerar-icones.mjs — não edite manualmente.
// Fonte: public/assets/partsagricola-icons.svg (kit oficial da marca).
// Para atualizar: troque o sprite e rode \`npm run icones\`.
import React from "react"

import { IconProps } from "types/icon"

/**
 * Ícones Parts Agrícola.
 *
 * Grade 24×24, traço 1,8, terminais arredondados, cor de \`currentColor\` e
 * detalhes de destaque em \`--pa-green\` (fallback \`#0B6B3F\`), conforme o kit.
 *
 * As classes \`.pa-accent\` e \`.pa-fill-accent\` vêm do sprite e estão definidas
 * em \`styles/globals.css\` — é por elas que o verde de destaque continua
 * sobreponível por \`--pa-green\`.
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

${componentes.join("\n\n")}
`

writeFileSync(SAIDA, arquivo, "utf8")
console.log(`${simbolos.length} ícones gerados -> ${path.relative(RAIZ, SAIDA)}`)
console.log("  " + simbolos.map(([, id]) => paraNome(id)).join(", "))
