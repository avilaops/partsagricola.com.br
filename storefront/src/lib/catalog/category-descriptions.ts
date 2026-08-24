/**
 * Descrição editorial de cada categoria — texto único por página, escrito à
 * mão. A camada de leitura não guarda descrição (a taxonomia nasceu do nome
 * dos produtos); manter o texto no código deixa a curadoria versionada junto
 * com o site e evita mais uma coluna sincronizada.
 *
 * Onde aparece: hero da página da categoria, cards "Escolha uma linha" e a
 * meta description (SEO). Regra do texto: dizer o que a linha cobre e como
 * comprar certo (código + aplicação), sem prometer estoque nem afiliação a
 * marca nenhuma.
 */

const DESCRICOES: Record<string, string> = {
  // ── Departamentos ────────────────────────────────────────────────────────
  "pecas-agricolas":
    "Peças de reposição para o campo: colheitadeiras, plantadeiras, pulverizadores e tratores das principais linhas que operam no Brasil. Busque pelo código da peça ou navegue pela cultura — grãos, cana, algodão, amendoim — e confirme a aplicação antes do pedido.",
  "maquinas-pesadas":
    "Componentes para máquinas de construção e mineração: escavadeiras, pás-carregadeiras, motoniveladoras e tratores de esteira. Material rodante, reparos hidráulicos e itens de desgaste identificados por código de referência do fabricante.",
  "vedacoes-e-selagem":
    "Vedações hidráulicas e pneumáticas: retentores, gaxetas, raspadores, o-rings e kits completos por equipamento. Referências cruzadas com as medidas e os códigos usados pelas montadoras — confirme dimensões antes de solicitar.",
  "kits-e-reparos":
    "Kits de reparo prontos: jogos completos de vedação e componentes para cilindros, bombas e comandos hidráulicos. Um código, todas as peças da intervenção — sem montar item a item.",

  // ── Peças agrícolas: culturas e linhas ───────────────────────────────────
  algodao:
    "Peças para colheitadeiras e implementos da cultura do algodão: componentes de colheita, fusos, guias e itens de desgaste. Identifique pelo código gravado na peça usada e confirme a aplicação na ficha.",
  amendoim:
    "Reposição para arrancadores, invertedores e colhedoras de amendoim: facas, correntes, esteiras e componentes de tração para a linha amendoim.",
  "cana-de-acucar":
    "Peças para colhedoras de cana e plantadoras: facas de corte de base, rolos, correntes, mancais e itens de desgaste do setor sucroenergético. Referências por código para John Deere, Case IH e outras linhas que operam no canavial.",
  graos:
    "Componentes para a colheita de grãos: peças de plataforma, trilha, separação e limpeza de colheitadeiras, além de itens de plantadeiras e carretas graneleiras. Soja, milho, trigo — busque pelo código da peça.",
  "implementos-agricolas":
    "Peças para implementos: plantadeiras, pulverizadores, distribuidores, grades e plainas. Discos, facas, bicos, mancais e componentes de transmissão identificados por código de referência.",
  "linha-verde":
    "Reposição para a linha verde — jardinagem, gramados e manutenção de áreas: peças para roçadeiras, microtratores e equipamentos compactos.",
  tratores:
    "Peças de reposição para tratores agrícolas: motor, transmissão, hidráulico, direção e rodagem. Cobrimos as linhas mais comuns no Brasil — confirme o modelo e o código antes do pedido.",

  // ── Máquinas pesadas ─────────────────────────────────────────────────────
  construcao:
    "Peças para equipamentos de construção: escavadeiras, retroescavadeiras, pás-carregadeiras e motoniveladoras. Componentes hidráulicos, itens de desgaste e reposição geral por código do fabricante.",
  "material-rodante":
    "Material rodante para máquinas de esteira: roletes, rodas-guia, coroas, sapatas, elos e pinos e buchas. Medidas e códigos de referência na ficha de cada item para conferência antes da compra.",

  // ── Kits e reparos ───────────────────────────────────────────────────────
  "direcao-hidraulica":
    "Reparos completos para direção hidráulica e hidrostática: kits de vedação, componentes do orbitrol e da caixa de direção para tratores, colheitadeiras e máquinas de construção.",

  // ── Vedações e selagem ───────────────────────────────────────────────────
  "gaxetas-e-raspadores":
    "Gaxetas de haste e êmbolo e raspadores para cilindros hidráulicos: perfis U, V, chevron e compactos, em poliuretano, NBR e Viton. Selecione pela medida (haste × alojamento) e confira o perfil na ficha.",
  "o-rings":
    "Anéis o-ring em NBR, Viton e silicone, nas séries standard (polegada) e milimétrica. Vendidos por medida — diâmetro interno × espessura do cordão — com equivalências às referências mais usadas.",
  "o-rings-standard":
    "O-rings da série standard (medidas em polegada, padrão AS568): do -001 ao -475, em NBR 70/90, Viton e outros compostos. Confirme a medida nominal na ficha antes do pedido.",
  "o-rings-milimetricos":
    "O-rings de medida milimétrica: diâmetro interno × cordão em milímetros, para aplicações fora do padrão polegada. Diversos compostos e durezas — confira a medida exata na ficha.",
  "reparos-pneumaticos":
    "Kits e componentes para sistemas pneumáticos: reparos de válvulas, cilindros de freio, secadores e engates rápidos para caminhões, carretas e implementos.",
  retentores:
    "Retentores de óleo e graxa para eixos, cubos, bombas e transmissões: medidas por diâmetro interno × externo × altura, com referência cruzada aos códigos das montadoras.",
  "vedacoes-industriais":
    "Jogos e kits de vedação organizados por fabricante do equipamento: Caterpillar, Komatsu, Volvo, JCB, Case e outras linhas. Escolha a marca da máquina e localize o kit pelo código do cilindro ou do comando.",
}

/**
 * Marcas sob "Vedações Industriais" (21 páginas): texto gerado por marca —
 * cada página nomeia a própria linha, sem parágrafo idêntico repetido.
 */
function descricaoMarcaVedacao(nome: string): string {
  return `Kits e jogos de vedação para equipamentos ${nome}: cilindros hidráulicos, comandos e componentes correlatos, identificados pelo código de referência da linha ${nome}. Compatibilidade informada no catálogo, sem afiliação com o fabricante — confirme o código do kit na ficha antes do pedido.`
}

/** Descrição da categoria; toda página tem texto próprio. */
export function descricaoCategoria(
  handle: string,
  nome: string
): string | null {
  if (DESCRICOES[handle]) return DESCRICOES[handle]
  if (handle.startsWith("vedacoes-industriais-")) {
    return descricaoMarcaVedacao(nome)
  }
  return null
}
