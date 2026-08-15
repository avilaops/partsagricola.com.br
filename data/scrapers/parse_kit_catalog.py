#!/usr/bin/env python3
"""Extrai catalogos de 'kits de reparo' (padrao Codigo + Ref.Mercado + Aplicacao)
usados pela Rio Preto Vedacoes / Agel para caixas de direcao, pecas especiais
e linha automotiva.

Usa pdftotext SEM -layout (ordem de fluxo do PDF), que separa cada campo em
sua propria linha nesses catalogos de duas colunas -- muito mais limpo que
o modo -layout para este formato especifico.

Heuristica: uma linha contendo 'Rep.' fecha um registro (e a descricao/
aplicacao). O codigo mais recente visto (padrao tipo CX.99999, CX.99999/2)
vira o codigo do registro; qualquer linha entre o codigo e a descricao vira
'ref_mercado' (fabricante original: ZF, TRW, LUK, KYB...).
"""
import csv
import re
import sys

from pdf_text import extract_pdf_text

CODE_RE = re.compile(r"^([A-Z]{2,4}\.\d{3,6}(?:/\d+)?)\b\s*(.*)$")
APPLICATION_RE = re.compile(r"\bRep\.\s")
NOISE_LINES = {
    "aplicação",
    "aplicacao",
    "cód. agel ref. mercado",
    "cod. agel ref. mercado",
    "coifas",
    "buchas",
    "página",
    "pagina",
}


def extract_text(pdf_path: str) -> str:
    return extract_pdf_text(pdf_path)


def is_noise(line: str) -> bool:
    low = line.strip().lower()
    if not low:
        return True
    if low in NOISE_LINES:
        return True
    if re.fullmatch(r"[\d\s]+", low):  # bloco solto de numeros de pagina
        return True
    if re.fullmatch(r"p[aá]g\.?\s*\w*", low):
        return True
    return False


def parse(pdf_path: str, marca: str, linha: str):
    text = extract_text(pdf_path)
    lines = [l.strip() for l in text.split("\n")]

    rows = []
    pending_code = None
    pending_extra = []
    seen = set()

    for line in lines:
        if is_noise(line):
            continue

        m_code = CODE_RE.match(line)
        if m_code:
            # nova linha de codigo -- se ja havia um codigo pendente sem
            # descricao (registro incompleto), descarta e comeca de novo
            pending_code = m_code.group(1)
            rest = m_code.group(2).strip()
            pending_extra = [rest] if rest else []
            # as vezes codigo+ref+descricao vem tudo na mesma linha
            if rest and APPLICATION_RE.search(rest):
                _finalize(rows, seen, marca, linha, pending_code, [], rest, pdf_path)
                pending_code = None
                pending_extra = []
            continue

        if pending_code is None:
            continue

        if APPLICATION_RE.search(line):
            _finalize(rows, seen, marca, linha, pending_code, pending_extra, line, pdf_path)
            pending_code = None
            pending_extra = []
        else:
            pending_extra.append(line)

    return rows


def _finalize(rows, seen, marca, linha, codigo, extra_lines, descricao, pdf_path):
    ref_mercado = " ".join(x for x in extra_lines if x).strip()
    descricao = descricao.strip()
    key = (codigo, descricao)
    if key in seen:
        return
    seen.add(key)
    rows.append(
        {
            "marca": marca,
            "linha": linha,
            "codigo": codigo,
            "ref_mercado": ref_mercado,
            "descricao": descricao,
            "fonte_pdf": pdf_path,
        }
    )


def main():
    targets = [
        ("data/pdfs/riopretovedacoes/Catalogo_Caixa_Direcao.pdf", "Rio Preto Vedações", "Caixa de Direção"),
        ("data/pdfs/riopretovedacoes/Catalogo_Pecas_Especiais.pdf", "Rio Preto Vedações", "Peças Especiais"),
        ("data/pdfs/agel/catalogo-automotivo-direcao-hidraulica-2025.pdf", "Agel", "Automotivo - Direção Hidráulica"),
    ]

    all_rows = []
    for pdf_path, marca, linha in targets:
        rows = parse(pdf_path, marca, linha)
        print(f"{pdf_path}: {len(rows)} registros")
        all_rows.extend(rows)

    out_path = "data/kits_catalogo.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["marca", "linha", "codigo", "ref_mercado", "descricao", "fonte_pdf"]
        )
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nTotal: {len(all_rows)} registros salvos em {out_path}")


if __name__ == "__main__":
    main()
