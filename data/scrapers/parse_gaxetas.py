#!/usr/bin/env python3
"""Extrai reparos, gaxetas e raspadores das tabelas finais dos catálogos."""

import csv
import os
import re

from pdf_text import extract_pdf_text


SECTION_RE = re.compile(r"REPAROS\s+E\s+COMPONENTES\s+PNEUM", re.IGNORECASE)
ROW_RE = re.compile(
    r"^\s*([A-Z0-9][A-Z0-9/-]{2,20})\s{2,}"
    r"(.+?)"
    r"(?:\s{2,}([\d,]+)\s+([\d,]+)\s+([\d,]+))?\s*$"
)
MIN_EXPECTED_ROWS = 20


def extract_text(pdf_path: str) -> str:
    return extract_pdf_text(pdf_path, layout=True)


def parse(pdf_path: str, brand: str):
    lines = extract_text(pdf_path).splitlines()
    rows = []
    in_section = False

    for line in lines:
        if SECTION_RE.search(line):
            in_section = True
            continue
        if not in_section:
            continue

        match = ROW_RE.match(line)
        if not match:
            continue

        code, description, inner, external, height = match.groups()
        if code in {"CÓDIGO", "CODIGO"}:
            continue
        description = re.sub(r"\s+", " ", description).strip()
        if not description or not re.search(
            r"GAXETA|RASPADOR|GUARNIÇÃO|GUARNICAO|REPARO",
            description,
            re.IGNORECASE,
        ):
            continue

        rows.append(
            {
                "marca": brand,
                "linha": (
                    "Reparos Pneumáticos"
                    if description.upper().startswith("REPARO")
                    else "Gaxetas e Raspadores"
                ),
                "codigo": code,
                "descricao": description,
                "interno_mm": inner or "",
                "externo_mm": external or "",
                "altura_mm": height or "",
                "fonte_pdf": pdf_path,
            }
        )

    return rows


def main():
    targets = [
        (
            "data/pdfs/riopretovedacoes/Catalogo_Gaxetas_Raspadores.pdf",
            "Rio Preto Vedações",
        ),
        (
            "data/pdfs/agel/catalogo-gaxetas-raspadores-2022.pdf",
            "Agel",
        ),
    ]
    all_rows = []
    for pdf_path, brand in targets:
        rows = parse(pdf_path, brand)
        print(f"{pdf_path}: {len(rows)} itens extraidos")
        all_rows.extend(rows)

    if len(all_rows) < MIN_EXPECTED_ROWS:
        raise RuntimeError(
            f"Extracao produziu somente {len(all_rows)} linhas; "
            f"minimo seguro: {MIN_EXPECTED_ROWS}. CSV anterior preservado."
        )

    output_path = "data/gaxetas_raspadores.csv"
    temporary_path = f"{output_path}.tmp"
    with open(temporary_path, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "marca",
                "linha",
                "codigo",
                "descricao",
                "interno_mm",
                "externo_mm",
                "altura_mm",
                "fonte_pdf",
            ],
        )
        writer.writeheader()
        writer.writerows(all_rows)
    os.replace(temporary_path, output_path)

    print(f"\nTotal preservando as fontes: {len(all_rows)} -> {output_path}")


if __name__ == "__main__":
    main()
