#!/usr/bin/env python3
"""Extrai as tabelas de o-rings (Standard e Milimetrico) da Agel.

Formato: grade de 5 colunas repetidas por pagina, cada celula e um trio
"codigo AGEL / diametro interno (D.I.) / tolerancia". O modo -layout do
pdftotext preserva bem o alinhamento aqui (ao contrario dos catalogos de
retentores), entao um regex simples sobre o texto com -layout resolve.
"""
import csv
import re

from pdf_text import extract_pdf_text

TRIPLE_RE = re.compile(r"\b(\d-\d{3})\s+([\d,]+)\s+([\d,]+)\b")
MILIMETRICO_RE = re.compile(r"\b(\d{4})\s+([\d,]+)\s+([\d,]+)\b")


def extract_text(pdf_path: str) -> str:
    return extract_pdf_text(pdf_path, layout=True)


def parse(pdf_path: str, linha: str, pattern: re.Pattern, col3_name: str):
    text = extract_text(pdf_path)
    rows = []
    seen = set()
    for m in pattern.finditer(text):
        codigo, di, col3 = m.group(1), m.group(2), m.group(3)
        if codigo in seen:
            continue
        seen.add(codigo)
        rows.append(
            {
                "marca": "Agel",
                "linha": linha,
                "codigo": codigo,
                "diametro_interno_mm": di,
                "tolerancia_mm": col3 if col3_name == "tolerancia_mm" else "",
                "secao_w_mm": col3 if col3_name == "secao_w_mm" else "",
                "fonte_pdf": pdf_path,
            }
        )
    return rows


def main():
    targets = [
        ("data/pdfs/agel/catalogo-o-rings-standard-2025.pdf", "O-Rings Standard", TRIPLE_RE, "tolerancia_mm"),
        ("data/pdfs/agel/catalogo-o-rings-milimetrico-2025.pdf", "O-Rings Milimétrico", MILIMETRICO_RE, "secao_w_mm"),
    ]
    all_rows = []
    for pdf_path, linha, pattern, col3_name in targets:
        rows = parse(pdf_path, linha, pattern, col3_name)
        print(f"{pdf_path}: {len(rows)} o-rings extraidos")
        all_rows.extend(rows)

    out_path = "data/orings.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["marca", "linha", "codigo", "diametro_interno_mm", "tolerancia_mm", "secao_w_mm", "fonte_pdf"],
        )
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nTotal: {len(all_rows)} -> {out_path}")


if __name__ == "__main__":
    main()
