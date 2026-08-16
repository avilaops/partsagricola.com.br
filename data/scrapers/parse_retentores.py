#!/usr/bin/env python3
"""Extrai catalogos de retentores (Rio Preto Vedacoes e Agel).

O pdftotext SEM -layout despeja a tabela "transposta": um bloco de N
codigos, depois um bloco de N valores de eixo, depois N de diametro
externo, etc. Reconstroi as linhas por posicao dentro de cada bloco de
pagina, usando os cabecalhos (Codigo/Eixo/Externo/Altura/Modelo/Material)
como marcadores. 'Mercado' (referencia cruzada) e esparso e sem alinhamento
posicional confiavel, entao fica de fora do resultado principal.
"""
import csv
import re

from pdf_text import extract_pdf_text

HEADERS = ["Código", "Eixo", "Externo", "Altura", "Modelo", "Mercado", "Material"]

# SEM re.IGNORECASE de proposito.
#
# O catalogo tem paragrafos explicativos ("...a escolha do material elastomerico
# e de suma importancia...", "...a velocidade periferica do eixo...") em caixa
# baixa. Com IGNORECASE essas palavras no meio da prosa eram lidas como cabecalho
# de coluna, e o paragrafo inteiro entrava como valor de Material — inflando o
# bloco em ate 16 tokens. Como `build_rows` exigia Material do mesmo tamanho que
# Codigo, a pagina inteira era descartada: 37 das 42 paginas, 1.668 pecas.
HEADER_RE = re.compile(
    r"^(Código|Eixo|(?:Dimensões\s+)?Externo|Altura|Modelo|Mercado|Material)\b(.*)$"
)
NUM_TOKEN_RE = re.compile(r"^[\d.,/]+$")

# Medida sempre tem virgula decimal ("10,00", "4,00/6,00"). Inteiro solto no fim
# de um bloco numerico e o numero da pagina impresso no rodape, que o pdftotext
# entrega junto — era o que deixava Altura com um item a mais que Codigo.
MEDIDA_RE = re.compile(r"^\d+(?:[.,]\d+)?(?:\s*/\s*\d+(?:[.,]\d+)?)*$")
NUM_PAGINA_RE = re.compile(r"^\d{1,3}$")


def normalize_header(word: str) -> str:
    w = word.lower()
    if w.startswith("c"):
        return "Código"
    if w.startswith("eixo"):
        return "Eixo"
    if "extern" in w:
        return "Externo"
    if w.startswith("altura"):
        return "Altura"
    if w.startswith("modelo"):
        return "Modelo"
    if w.startswith("mercado"):
        return "Mercado"
    if w.startswith("material"):
        return "Material"
    return word


def extract_text(pdf_path: str) -> str:
    return extract_pdf_text(pdf_path)


def tokenize_blocks(text: str):
    """Retorna lista de (header_normalizado, [tokens]) na ordem em que aparecem."""
    lines = text.split("\n")
    blocks = []
    current_header = None
    current_tokens: list[str] = []

    def flush():
        if current_header is not None:
            blocks.append((current_header, current_tokens[:]))

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if "linha de retentores" in line.lower():
            continue
        if line.lower().startswith("cat") and "retentor" in line.lower():
            continue

        m = HEADER_RE.match(line)
        if m:
            flush()
            current_header = normalize_header(m.group(1))
            current_tokens = []
            rest = m.group(2).strip()
            if rest:
                current_tokens.extend(rest.split())
            continue

        if current_header is not None:
            current_tokens.extend(line.split())

    flush()
    return blocks


def limpar_medidas(tokens: list[str], n_rows: int) -> list[str]:
    """Tira o numero da pagina do fim de um bloco de medidas.

    So mexe quando sobra exatamente um token e ele e um inteiro sem virgula no
    fim — o formato do rodape. Fora disso devolve o bloco intocado: um bloco com
    duas sobras e desalinhamento de verdade, e chutar qual token remover
    deslocaria a coluna inteira e publicaria medida errada.
    """
    if len(tokens) == n_rows + 1 and NUM_PAGINA_RE.match(tokens[-1] or ""):
        return tokens[:-1]
    return tokens


def para_numero(valor: str):
    """Primeiro numero de uma medida. "5,7/8,40" vira 5.7 — variantes do mesmo
    retentor, basta uma para conferir a coerencia."""
    valor = (valor or "").strip()
    if not valor:
        return None
    try:
        return float(valor.split("/")[0].replace(",", "."))
    except ValueError:
        return None


def medidas_coerentes(eixo: str, externo: str) -> bool:
    """Retentor tem furo menor que o diametro externo — nao existe excecao.

    Linha que viola isso saiu de coluna deslocada ou de OCR trocado, e e o unico
    caso em que uma medida errada passaria despercebida: ela *parece* dado
    conferido. Melhor devolver para a quarentena."""
    e, x = para_numero(eixo), para_numero(externo)
    if e is None or x is None:
        return False
    return 0 < e < x


def build_rows(blocks, marca: str, fonte_pdf: str):
    """Reconstroi as linhas a partir dos blocos transpostos de cada pagina.

    Codigo, Eixo e Externo sao as tres colunas que o pdftotext entrega sempre
    completas — sao elas que definem se a pagina e aproveitavel. Altura, Modelo e
    Material entram so quando a contagem bate com a de Codigo; quando nao bate,
    a coluna fica vazia naquela pagina em vez de derrubar as 46 pecas.

    Aproveitar coluna desalinhada por posicao seria pior que perder a pagina:
    um retentor com altura do vizinho e uma peca errada vendida com aparencia de
    dado conferido.
    """
    rows = []
    i = 0
    n = len(blocks)
    while i < n:
        header, tokens = blocks[i]
        if header != "Código":
            i += 1
            continue

        # coleta os proximos blocos ate o proximo "Código" (ou fim)
        batch = {"Código": tokens}
        j = i + 1
        while j < n and blocks[j][0] != "Código":
            h, t = blocks[j]
            batch.setdefault(h, [])
            batch[h].extend(t)
            j += 1

        codigos = batch.get("Código", [])
        n_rows = len(codigos)

        eixos = limpar_medidas(batch.get("Eixo", []), n_rows)
        externos = limpar_medidas(batch.get("Externo", []), n_rows)
        alturas = limpar_medidas(batch.get("Altura", []), n_rows)
        modelos = batch.get("Modelo", [])
        materiais = batch.get("Material", [])

        aligned = (
            n_rows > 0
            and len(eixos) == n_rows
            and len(externos) == n_rows
        )

        if aligned:
            alturas_aligned = len(alturas) == n_rows
            modelos_aligned = len(modelos) == n_rows
            materiais_aligned = len(materiais) == n_rows

            for k in range(n_rows):
                coerente = medidas_coerentes(eixos[k], externos[k])
                tem_altura = alturas_aligned and bool(alturas[k].strip())
                rows.append(
                    {
                        "marca": marca,
                        "linha": "Retentores",
                        "codigo": codigos[k],
                        "eixo_mm": eixos[k],
                        "externo_mm": externos[k],
                        "altura_mm": alturas[k] if alturas_aligned else "",
                        "modelo": modelos[k] if modelos_aligned else "",
                        "material": materiais[k] if materiais_aligned else "",
                        "revisar": "nao" if (tem_altura and coerente) else "sim",
                        "fonte_pdf": fonte_pdf,
                    }
                )
        i = j

    return rows


# --- Agel -------------------------------------------------------------------
#
# Layout completamente diferente do Rio Preto: aqui o pdftotext entrega a linha
# inteira ("AG7581 20,00 47,10 10,00"), com MAT/ORI/REF nas linhas seguintes.
# Nao ha tabela transposta, e por isso `build_rows` nunca produziu nada deste
# catalogo — ele procura blocos Eixo/Externo/Altura que este PDF nao tem.

AGEL_COD_DIMS_RE = re.compile(
    r"^([A-Z0-9][A-Z0-9./-]*)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)$"
)
AGEL_DIMS_RE = re.compile(r"^(\d+[,.]\d+)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)$")
AGEL_COD_RE = re.compile(r"^[A-Z0-9][A-Z0-9./-]{2,}$")
AGEL_MATERIAIS = {"NBR", "FPM", "PU", "MVQ", "ACM", "PTFE", "VITON", "SIL"}


def parse_agel(text: str, marca: str, fonte_pdf: str):
    """Le o catalogo Agel, uma peca por registro.

    A ambiguidade do formato e que tanto o codigo quanto a referencia cruzada
    (REF) podem ser um numero solto — "5670" e um retentor, "00909" e a
    referencia do anterior. O que separa os dois e o que vem depois: codigo e
    seguido pelas tres medidas, referencia nao. Sem essa regra, cada REF viraria
    uma peca fantasma sem medida nenhuma.
    """
    linhas = [l.strip() for l in text.split("\n") if l.strip()]
    rows = []

    i = 0
    while i < len(linhas):
        linha = linhas[i]
        codigo = eixo = externo = altura = None

        direto = AGEL_COD_DIMS_RE.match(linha)
        if direto:
            codigo, eixo, externo, altura = direto.groups()
            i += 1
        elif (
            AGEL_COD_RE.match(linha)
            and i + 1 < len(linhas)
            and AGEL_DIMS_RE.match(linhas[i + 1])
        ):
            codigo = linha
            eixo, externo, altura = AGEL_DIMS_RE.match(linhas[i + 1]).groups()
            i += 2
        else:
            i += 1
            continue

        # MAT e ORI vem logo depois, as vezes na mesma linha ("NBR LI").
        material = ""
        for offset in range(0, 3):
            if i + offset >= len(linhas):
                break
            primeiro = linhas[i + offset].split()[0] if linhas[i + offset] else ""
            if primeiro in AGEL_MATERIAIS:
                material = primeiro
                break

        rows.append(
            {
                "marca": marca,
                "linha": "Retentores",
                "codigo": codigo,
                "eixo_mm": eixo,
                "externo_mm": externo,
                "altura_mm": altura,
                "modelo": "",
                "material": material,
                "revisar": "nao" if medidas_coerentes(eixo, externo) else "sim",
                "fonte_pdf": fonte_pdf,
            }
        )

    return rows


def main():
    all_rows = []

    rp_pdf = "data/pdfs/riopretovedacoes/Catalogo_Retentores.pdf"
    rp_rows = build_rows(tokenize_blocks(extract_text(rp_pdf)), "Rio Preto Vedações", rp_pdf)
    print(f"{rp_pdf}: {len(rp_rows)} retentores extraidos")
    all_rows.extend(rp_rows)

    agel_pdf = "data/pdfs/agel/catalogo-retentores-2021.pdf"
    agel_rows = parse_agel(extract_text(agel_pdf), "Agel", agel_pdf)
    print(f"{agel_pdf}: {len(agel_rows)} retentores extraidos")
    all_rows.extend(agel_rows)

    # dedupe por (marca, codigo, eixo, externo) -- o mesmo codigo pode repetir
    # entre paginas por causa de indices/sumarios
    seen = set()
    dedup = []
    for r in all_rows:
        key = (r["marca"], r["codigo"], r["eixo_mm"], r["externo_mm"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(r)

    out_path = "data/retentores.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "marca",
                "linha",
                "codigo",
                "eixo_mm",
                "externo_mm",
                "altura_mm",
                "modelo",
                "material",
                "revisar",
                "fonte_pdf",
            ],
        )
        writer.writeheader()
        writer.writerows(dedup)

    print(f"\nTotal (com dedupe): {len(dedup)} de {len(all_rows)} brutos -> {out_path}")


if __name__ == "__main__":
    main()
