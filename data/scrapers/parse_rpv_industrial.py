#!/usr/bin/env python3
"""Extrai o catalogo Industrial da Rio Preto Vedacoes (formato: secoes
'Linha: <MARCA>' seguidas de uma lista Codigo + Descricao).

pdftotext -layout produz ruido nas bordas de coluna (cabecalhos
'Descricao'/'Codigo' aparecem intercalados nas linhas de dado por causa do
layout original em duas colunas). O parser filtra esse ruido e marca como
'revisar' qualquer linha sem descricao reconhecida.
"""
import csv
import re

from pdf_text import extract_pdf_text

PDF_PATH = "data/pdfs/riopretovedacoes/Catalogo_Industrial.pdf"
OUT_CSV = "data/riopretovedacoes_industrial.csv"

HEADER_NOISE = {"código", "descrição", "descricao", "codigo"}

# codigo: alfanumerico com pontos/hifens, ex: 6504959, 100529 A1, 1542929-C1PM
CODE_RE = re.compile(r"^\s*([0-9A-Z][0-9A-Za-z\-\. /]{2,20}?)\s{2,}(\S.*)$")
LINE_HEADER_RE = re.compile(r"^\s*Linha:\s*(.+)$", re.IGNORECASE)
TRAILING_NOISE_RE = re.compile(r"\s*(descri[cç][aã]o|c[oó]digo)\s*$", re.IGNORECASE)
MIN_EXPECTED_ROWS = 3000
KNOWN_LINES = (
    "New Holland Industrial",
    "Massey Ferguson",
    "Yale Carregadeira",
    "Michigan Anéis",
    "Fiat Anéis",
    "Huber Warco",
    "Caterpillar",
    "Bob Cat",
    "Danfoss",
    "Dinapac",
    "Engesa",
    "Hyundai",
    "Komatsu",
    "Michigan",
    "Muller",
    "Randon",
    "Volvo",
    "Case",
    "Fiat",
    "JCB",
)


def normalize_line_name(raw_name: str) -> str:
    compact = re.sub(r"\s+", " ", raw_name).strip()
    for known_line in KNOWN_LINES:
        if compact.casefold().startswith(known_line.casefold()):
            return known_line
    return compact


def extract_text():
    return extract_pdf_text(PDF_PATH, layout=True)


def main():
    text = extract_text()
    lines = text.split("\n")

    rows = []
    current_line = ""
    seen_codes = set()

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            continue

        m_line = LINE_HEADER_RE.match(line)
        if m_line:
            name = m_line.group(1).strip()
            name = TRAILING_NOISE_RE.sub("", name).strip()
            if name:
                current_line = normalize_line_name(name)
            continue

        stripped = line.strip()
        if stripped.lower() in HEADER_NOISE:
            continue

        m = CODE_RE.match(line)
        if not m:
            continue

        codigo = m.group(1).strip()
        descricao = m.group(2).strip()

        if descricao.lower() in HEADER_NOISE:
            descricao = ""

        # ignora numero de pagina solto tipo "3" isolado
        if re.fullmatch(r"\d{1,3}", codigo) and len(codigo) <= 3:
            continue

        key = (current_line, codigo)
        if key in seen_codes:
            continue
        seen_codes.add(key)

        rows.append(
            {
                "marca": "Rio Preto Vedações",
                "linha": current_line,
                "codigo": codigo,
                "descricao": descricao,
                "revisar": "sim" if not descricao else "nao",
                "fonte_pdf": PDF_PATH,
            }
        )

    if len(rows) < MIN_EXPECTED_ROWS:
        raise RuntimeError(
            f"Extracao produziu somente {len(rows)} linhas; "
            f"minimo seguro: {MIN_EXPECTED_ROWS}. CSV anterior preservado."
        )

    temporary_path = f"{OUT_CSV}.tmp"
    with open(temporary_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["marca", "linha", "codigo", "descricao", "revisar", "fonte_pdf"]
        )
        writer.writeheader()
        writer.writerows(rows)
    import os

    os.replace(temporary_path, OUT_CSV)

    total = len(rows)
    to_review = sum(1 for r in rows if r["revisar"] == "sim")
    print(f"Total extraido: {total} (marcados p/ revisar: {to_review})")
    print(f"Salvo em {OUT_CSV}")


if __name__ == "__main__":
    main()
