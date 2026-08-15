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
HEADER_RE = re.compile(
    r"^(C[oó]digo|Eixo|(?:Dimens[oõ]es\s+)?Externo|Altura|Modelo|Mercado|Material)\b(.*)$",
    re.IGNORECASE,
)
NUM_TOKEN_RE = re.compile(r"^[\d.,/]+$")


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


def build_rows(blocks, marca: str, fonte_pdf: str):
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
        eixos = batch.get("Eixo", [])
        externos = batch.get("Externo", [])
        alturas = batch.get("Altura", [])
        modelos = batch.get("Modelo", [])
        materiais = batch.get("Material", [])

        n_rows = len(codigos)
        aligned = (
            n_rows > 0
            and len(eixos) == n_rows
            and len(externos) == n_rows
            and len(modelos) == n_rows
            and len(materiais) == n_rows
        )

        if aligned:
            alturas_aligned = len(alturas) == n_rows
            for k in range(n_rows):
                rows.append(
                    {
                        "marca": marca,
                        "linha": "Retentores",
                        "codigo": codigos[k],
                        "eixo_mm": eixos[k],
                        "externo_mm": externos[k],
                        "altura_mm": alturas[k] if alturas_aligned else "",
                        "modelo": modelos[k],
                        "material": materiais[k],
                        "revisar": "nao" if alturas_aligned else "sim",
                        "fonte_pdf": fonte_pdf,
                    }
                )
        i = j

    return rows


def main():
    targets = [
        ("data/pdfs/riopretovedacoes/Catalogo_Retentores.pdf", "Rio Preto Vedações"),
        ("data/pdfs/agel/catalogo-retentores-2021.pdf", "Agel"),
    ]

    all_rows = []
    for pdf_path, marca in targets:
        text = extract_text(pdf_path)
        blocks = tokenize_blocks(text)
        rows = build_rows(blocks, marca, pdf_path)
        print(f"{pdf_path}: {len(rows)} retentores extraidos")
        all_rows.extend(rows)

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
