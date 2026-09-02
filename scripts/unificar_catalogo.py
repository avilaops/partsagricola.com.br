#!/usr/bin/env python3
"""
Unifica as fontes do catálogo num vocabulário único de medida.

O problema que isto resolve: cada fornecedor nomeia a mesma medida física
de um jeito ("Diâmetro Interno", "eixo_mm", "interno_mm",
"diametro_interno_mm"), então hoje o cliente precisa saber de que
fornecedor é a peça para conseguir filtrar. Na prateleira é a mesma peça.

Aqui NADA é fundido. Cada produto continua sendo o do seu fornecedor —
duas fontes com a mesma medida viram duas linhas, que é justamente o que
se quer mostrar lado a lado. O que se unifica é o vocabulário.

De-para aplicado:

    interno_mm  <- imdepa "Diâmetro Interno" | retentor eixo_mm
                   gaxeta interno_mm         | o-ring diametro_interno_mm
    externo_mm  <- imdepa "Diâmetro Externo" | retentor/gaxeta externo_mm
    altura_mm   <- imdepa "Largura"          | retentor/gaxeta altura_mm
    secao_mm    <- o-ring secao_w_mm

Idempotente: reexecutar atualiza, não duplica.

    python scripts/unificar_catalogo.py
    python scripts/unificar_catalogo.py --truncate
"""
import argparse
import csv
import json
import os
import re
import sys

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError:
    sys.exit("psycopg (v3) não instalado.  pip install 'psycopg[binary]'")

DEFAULT_DSN = os.environ.get(
    "IMDEPA_DSN", "postgresql://catalogo:catalogo@localhost:5432/catalogo_db"
)
LOTE = 1000


# ---------------------------------------------------------------------
# Normalização
# ---------------------------------------------------------------------
def num(valor):
    """'10,46' -> 10.46 ; '1.051,56' -> 1051.56 ; '' -> None (pt-BR)."""
    if valor is None:
        return None
    t = str(valor).strip()
    if not t:
        return None
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    try:
        v = float(t)
    except ValueError:
        return None
    # medida em mm acima disso é dado sujo, não peça
    return round(v, 3) if 0 < v < 100000 else None


def mm_de_texto(valor):
    """'35 mm' -> 35.0 ; ignora polegada (já tratada na carga da Imdepa)."""
    if not valor:
        return None
    m = re.match(r"^\s*([\d.,]+)\s*mm", str(valor), re.I)
    return num(m.group(1)) if m else None


def cod_norm(codigo):
    return re.sub(r"[^A-Z0-9]", "", (codigo or "").upper())


# Palavra no nome -> tipo de peça. A ordem importa: a primeira que casar
# vence, então os termos mais específicos vêm antes.
TIPOS = [
    ("retentor",  ("retentor",)),
    ("o-ring",    ("o-ring", "oring", "anel o'ring", "anel oring")),
    ("gaxeta",    ("gaxeta", "raspador")),
    ("rolamento", ("rolamento",)),
    ("mancal",    ("mancal",)),
    ("bucha",     ("bucha",)),
    ("correia",   ("correia",)),
]


def tipo_de(nome, padrao="outro"):
    n = (nome or "").lower()
    for slug, termos in TIPOS:
        if any(t in n for t in termos):
            return slug
    return padrao


# ---------------------------------------------------------------------
# Leitores por fonte — cada um devolve dicts no vocabulário único
# ---------------------------------------------------------------------
def ler_imdepa(path="data/imdepa.json"):
    if not os.path.exists(path):
        return
    for r in json.load(open(path, encoding="utf-8")):
        info = r.get("info_tecnica", {}) or {}
        nome = r.get("nome") or r.get("codigo") or r.get("product_id")
        yield {
            "fornecedor": "imdepa",
            "origem": "imdepa",
            "origem_id": r["product_id"],
            "codigo": r.get("codigo") or r["product_id"],
            "nome": nome,
            "marca": r.get("marca") or None,
            "linha": r.get("categoria1") or None,
            "tipo": tipo_de(nome or r.get("categoria1")),
            "interno_mm": mm_de_texto(info.get("Diâmetro Interno")),
            "externo_mm": mm_de_texto(info.get("Diâmetro Externo")),
            # A terceira dimensão muda de nome conforme a peça: rolamento
            # tem "Largura", retentor tem "Altura". É a mesma medida no
            # mesmo eixo — sem juntar as duas, retentor da Imdepa nunca
            # casaria com retentor da Rio Preto (que só tem altura_mm).
            "altura_mm": (mm_de_texto(info.get("Largura"))
                          or mm_de_texto(info.get("Altura"))),
            "secao_mm": None,
            "material": info.get("Material") or info.get("Materiais"),
            "descricao": r.get("descricao") or None,
            "imagem_url": (r.get("imagens") or [None])[0],
            "spec": info,
        }


def ler_retentores(path="data/retentores.csv"):
    if not os.path.exists(path):
        return
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if not r.get("codigo"):
            continue
        yield {
            "fornecedor": "rio-preto-vedacoes",
            "origem": "retentores",
            "origem_id": r["codigo"],
            "codigo": r["codigo"],
            "nome": f"Retentor {r['codigo']}"
                    + (f" {r['modelo']}" if r.get("modelo") else ""),
            "marca": r.get("marca") or None,
            "linha": r.get("linha") or None,
            "tipo": "retentor",
            # o "eixo" do retentor É o diâmetro interno
            "interno_mm": num(r.get("eixo_mm")),
            "externo_mm": num(r.get("externo_mm")),
            "altura_mm": num(r.get("altura_mm")),
            "secao_mm": None,
            "material": r.get("material") or None,
            "descricao": None,
            "imagem_url": None,
            "spec": {k: v for k, v in r.items() if v and k != "codigo"},
        }


def ler_gaxetas(path="data/gaxetas_raspadores.csv"):
    if not os.path.exists(path):
        return
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if not r.get("codigo"):
            continue
        desc = r.get("descricao") or ""
        yield {
            "fornecedor": "rio-preto-vedacoes",
            "origem": "gaxetas",
            "origem_id": r["codigo"],
            "codigo": r["codigo"],
            "nome": desc or f"Gaxeta {r['codigo']}",
            "marca": r.get("marca") or None,
            "linha": r.get("linha") or None,
            "tipo": tipo_de(desc, padrao="gaxeta"),
            "interno_mm": num(r.get("interno_mm")),
            "externo_mm": num(r.get("externo_mm")),
            "altura_mm": num(r.get("altura_mm")),
            "secao_mm": None,
            "material": None,
            "descricao": desc or None,
            "imagem_url": None,
            "spec": {k: v for k, v in r.items() if v and k != "codigo"},
        }


def ler_orings(path="data/orings.csv"):
    if not os.path.exists(path):
        return
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if not r.get("codigo"):
            continue
        yield {
            "fornecedor": "agel",
            "origem": "orings",
            "origem_id": r["codigo"],
            "codigo": r["codigo"],
            "nome": f"O-Ring {r['codigo']}",
            "marca": r.get("marca") or None,
            "linha": r.get("linha") or None,
            "tipo": "o-ring",
            "interno_mm": num(r.get("diametro_interno_mm")),
            "externo_mm": None,      # o-ring se define por DI + seção
            "altura_mm": None,
            "secao_mm": num(r.get("secao_w_mm")),
            "material": None,
            "descricao": None,
            "imagem_url": None,
            "spec": {k: v for k, v in r.items() if v and k != "codigo"},
        }


def ler_geomaq(path="data/geomaq_online.json"):
    """Geomaq não traz medida estruturada — entra pelo código e pelo texto.

    Sem medida, esses itens não aparecem no filtro dimensional (é honesto:
    não temos o dado), mas participam da busca por código e por texto.
    """
    if not os.path.exists(path):
        return
    for r in json.load(open(path, encoding="utf-8")):
        if not r.get("codigo"):
            continue
        yield {
            "fornecedor": "geomaq",
            "origem": "geomaq_online",
            "origem_id": str(r.get("geomaq_id") or r["codigo"]),
            "codigo": r["codigo"],
            "nome": r.get("nome") or r["codigo"],
            "marca": r.get("marca_compativel") or r.get("marca") or None,
            "linha": r.get("linha") or None,
            "tipo": tipo_de(r.get("nome")),
            "interno_mm": None,
            "externo_mm": None,
            "altura_mm": None,
            "secao_mm": None,
            "material": None,
            "descricao": (r.get("descricao") or None),
            "imagem_url": r.get("imagem_url") or None,
            "spec": {k: r[k] for k in ("sku_interno", "url_slug", "peso")
                     if r.get(k)},
        }


FONTES = [ler_imdepa, ler_retentores, ler_gaxetas, ler_orings, ler_geomaq]


# ---------------------------------------------------------------------
def unificar(dsn, truncate):
    with psycopg.connect(dsn, autocommit=False) as conn:
        cur = conn.cursor()
        cur.execute("SET search_path TO imdepa, catalogo, public")

        if truncate:
            cur.execute("TRUNCATE item RESTART IDENTITY CASCADE")
            print("item zerada")

        cur.execute("SELECT slug, id FROM fornecedor")
        forn = dict(cur.fetchall())
        cur.execute("SELECT slug, id FROM tipo_peca")
        tipos = dict(cur.fetchall())

        lote, total = [], 0
        por_fonte = {}
        for leitor in FONTES:
            n = 0
            for r in leitor():
                fid = forn.get(r["fornecedor"])
                if not fid:
                    continue
                lote.append((
                    fid, tipos.get(r["tipo"]), r["origem"], str(r["origem_id"]),
                    r["codigo"], cod_norm(r["codigo"]), r["nome"],
                    r["marca"], r["linha"],
                    r["interno_mm"], r["externo_mm"], r["altura_mm"], r["secao_mm"],
                    r["material"], r["descricao"], r["imagem_url"],
                    Jsonb(r["spec"] or {}),
                ))
                n += 1
                if len(lote) >= LOTE:
                    gravar(cur, lote)
                    conn.commit()
                    total += len(lote)
                    lote = []
            por_fonte[leitor.__name__.replace("ler_", "")] = n

        if lote:
            gravar(cur, lote)
            total += len(lote)
        conn.commit()

        for k, v in por_fonte.items():
            print(f"  {k:15} {v:>6}")
        cur.execute("SELECT count(*) FROM item")
        print(f"itens no catálogo unificado: {cur.fetchone()[0]}")

        cur.execute(
            "SELECT count(*) FROM item WHERE interno_mm IS NOT NULL "
            "OR externo_mm IS NOT NULL OR secao_mm IS NOT NULL"
        )
        print(f"com ao menos uma medida:     {cur.fetchone()[0]}")


def gravar(cur, lote):
    cur.executemany(
        """
        INSERT INTO item (
            fornecedor_id, tipo_id, origem, origem_id, codigo, codigo_norm,
            nome, marca, linha, interno_mm, externo_mm, altura_mm, secao_mm,
            material, descricao, imagem_url, spec
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (origem, origem_id) DO UPDATE SET
            tipo_id = EXCLUDED.tipo_id, codigo = EXCLUDED.codigo,
            codigo_norm = EXCLUDED.codigo_norm, nome = EXCLUDED.nome,
            marca = EXCLUDED.marca, linha = EXCLUDED.linha,
            interno_mm = EXCLUDED.interno_mm, externo_mm = EXCLUDED.externo_mm,
            altura_mm = EXCLUDED.altura_mm, secao_mm = EXCLUDED.secao_mm,
            material = EXCLUDED.material, descricao = EXCLUDED.descricao,
            imagem_url = EXCLUDED.imagem_url, spec = EXCLUDED.spec
        """,
        lote,
    )


def main():
    ap = argparse.ArgumentParser(description="Unifica as fontes do catálogo")
    ap.add_argument("--dsn", default=DEFAULT_DSN)
    ap.add_argument("--truncate", action="store_true")
    args = ap.parse_args()
    unificar(args.dsn, args.truncate)


if __name__ == "__main__":
    main()
