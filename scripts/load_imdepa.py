#!/usr/bin/env python3
"""
Carga do catálogo Imdepa (data/imdepa/*.json) no Postgres, schema `imdepa`.

O que faz além de inserir:
  * normaliza dimensões para mm e peso para kg — a fonte mistura "35 mm",
    '1.1/4"', "0,245kg" e "1.500 N"/"25,5 kN"; sem isso nenhum filtro por
    faixa funciona;
  * separa o payload de "Aplicação Equipamentos" (que vem grudado com
    JavaScript da loja) em máquinas compatíveis N:N;
  * guarda TODAS as specs cruas em product.spec (JSONB), então nada do
    que foi raspado se perde, mesmo o que não virou coluna.

Idempotente: reexecutar atualiza (ON CONFLICT), não duplica.

    python scripts/load_imdepa.py                    # carga completa
    python scripts/load_imdepa.py --truncate         # zera antes
    python scripts/load_imdepa.py --dsn postgresql://...
"""
import argparse
import glob
import json
import os
import re
import sys
import unicodedata

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError:
    sys.exit("psycopg (v3) não instalado.  pip install 'psycopg[binary]'")

DATA_DIR = "data/imdepa"

# nome do arquivo (= sitemap de origem) -> nome do departamento, na grafia
# que a própria loja usa nas outras categorias.
DEPARTAMENTOS = {
    "aneis": "Anéis",
    "arruelas": "Arruelas",
    "buchas": "Buchas",
    "correias": "Correias",
    "correntes": "Correntes",
    "embreagens": "Embreagens",
    "engrenagem": "Engrenagem",
    "esteiras": "Esteiras",
    "ferramentas": "Ferramentas",
    "lubrificante": "Lubrificante",
    "mancais": "Mancais",
    "mangueiras-e-terminais": "Mangueiras e Terminais",
    "pecas-automotivas": "Peças Automotivas",
    "porcas": "Porcas",
    "retentores": "Retentores",
    "rolamentos": "Rolamentos",
    "rotulas": "Rótulas",
    "vedacoes": "Vedações",
}
DEFAULT_DSN = os.environ.get(
    "IMDEPA_DSN", "postgresql://catalogo:catalogo@localhost:5432/catalogo_db"
)

# ---------------------------------------------------------------------
# Normalização
# ---------------------------------------------------------------------
def slugify(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return t or "sem-nome"


def _num(txt: str):
    """'1.051,56' -> 1051.56   |   '18.200' -> 18200   |   '35' -> 35.0

    A fonte é pt-BR: ponto é separador de milhar, vírgula é decimal.
    """
    if txt is None:
        return None
    t = txt.strip().replace(" ", "")
    if not t:
        return None
    if "," in t:                      # tem decimal explícito
        t = t.replace(".", "").replace(",", ".")
    elif t.count(".") == 1:
        inteiro, dec = t.split(".")
        # "1.051" é milhar; "1.5" é decimal. 3 dígitos após o ponto = milhar.
        if len(dec) == 3 and len(inteiro) <= 3:
            t = inteiro + dec
    else:
        t = t.replace(".", "")
    try:
        return float(t)
    except ValueError:
        return None


# 1.1/4"  ou  3/4"  ou  1/2"
RE_FRAC = re.compile(r'^\s*(?:(\d+)[.\s])?(\d+)\s*/\s*(\d+)\s*"')
RE_VAL_UNIT = re.compile(r"^\s*([\d.,]+)\s*(.*)$", re.S)


def to_mm(valor: str):
    """Converte um texto de medida para milímetros.

    Aceita mm, cm, m, polegada decimal (12") e fracionária (1.1/4").
    Quando o valor traz duas medidas ("22 mm / 10,7 mm"), usa a primeira —
    é o padrão da fonte para peças assimétricas.
    """
    if not valor:
        return None
    v = valor.strip()

    m = RE_FRAC.match(v)                       # fração em polegada
    if m:
        if float(m.group(3)) == 0:
            return None
        inteiro = float(m.group(1) or 0)
        pol = inteiro + float(m.group(2)) / float(m.group(3))
        return round(pol * 25.4, 3)

    m = RE_VAL_UNIT.match(v)
    if not m:
        return None
    n = _num(m.group(1))
    if n is None:
        return None
    unit = (m.group(2) or "").strip().lower()

    if unit and not re.match(r'^(mm|cm|m|pol(?:egadas?)?|in(?:ch(?:es)?)?|\")(?=$|\s|/)', unit):
        return None

    if unit.startswith('"') or unit.startswith("pol") or unit.startswith("in"):
        return round(n * 25.4, 3)
    if unit.startswith("cm"):
        return round(n * 10, 3)
    if unit.startswith("m") and not unit.startswith("mm"):
        return round(n * 1000, 3)
    return round(n, 3)                          # mm ou sem unidade


def to_kg(valor: str):
    if not valor:
        return None
    m = RE_VAL_UNIT.match(valor.strip())
    if not m:
        return None
    n = _num(m.group(1))
    if n is None:
        return None
    unit = (m.group(2) or "").strip().lower()
    if unit not in ("", "g", "kg"):
        return None
    if unit.startswith("g") and not unit.startswith("kg"):
        return round(n / 1000, 4)
    return round(n, 4)


def to_newton(valor: str):
    """'25,5 kN' -> 25500 ; '18.200 N' -> 18200"""
    if not valor:
        return None
    m = RE_VAL_UNIT.match(valor.strip())
    if not m:
        return None
    n = _num(m.group(1))
    if n is None:
        return None
    unit = (m.group(2) or "").strip().lower()
    if unit not in ("", "n", "kn"):
        return None
    if unit.startswith("kn"):
        return round(n * 1000, 2)
    return round(n, 2)


def to_rpm(valor: str):
    """'3.400 rpm com tolerância do eixo h6' -> 3400"""
    if not valor:
        return None
    m = RE_VAL_UNIT.match(valor.strip())
    if not m:
        return None
    return _num(m.group(1))


# Campos que são IDENTIFICADORES, não medidas. Extrair número deles não
# serve para nada (ninguém filtra "código de barras entre X e Y") e ainda
# estoura a escala de value_num, então ficam só como texto.
NAO_NUMERICOS = {
    "código de barras", "ncm", "código imdepa", "código da montadora",
    "código do fabricante", "gtin", "taxa ipi",
}


def num_generico(valor: str, chave: str = ""):
    """(valor_numérico, unidade) para product_spec — sem converter."""
    if not valor or chave.strip().lower() in NAO_NUMERICOS:
        return None, None
    m = RE_VAL_UNIT.match(valor.strip())
    if not m:
        return None, None
    n = _num(m.group(1))
    # value_num é NUMERIC(16,4): acima de 10^12 estoura. Um número desse
    # tamanho aqui nunca é medida — é identificador disfarçado.
    if n is None or abs(n) >= 10**12:
        return None, None
    unit = (m.group(2) or "").strip()[:20] or None
    return n, unit


# ---------------------------------------------------------------------
# Aplicação Equipamentos: separa máquinas do lixo de JavaScript
# ---------------------------------------------------------------------
RE_PAYLOAD = re.compile(r"content:\s*'(.*?)'\s*\}", re.S)
RE_MAQ = re.compile(r"^(.*?)\s*\((.*?)\)\s*$")
MONTADORAS = (
    "JOHN DEERE", "NEW HOLLAND", "MASSEY FERGUSON", "CASE IH", "VALTRA",
    "AGRALE", "AGCO", "CLAYSON", "MULLER", "IDEAL", "FNH", "SLC", "CATERPILLAR",
)


def parse_maquinas(valor: str):
    """Devolve [(montadora, modelo, nome_completo, faixa_serie)]."""
    if not valor:
        return []
    m = RE_PAYLOAD.search(valor)
    if not m:
        return []
    out, vistos = [], set()
    for item in m.group(1).split("-||-"):
        item = item.strip()
        if not item:
            continue
        mm = RE_MAQ.match(item)
        nome, faixa = (mm.group(1).strip(), mm.group(2).strip()) if mm else (item, None)
        if not nome or (nome, faixa) in vistos:
            continue
        vistos.add((nome, faixa))
        maker = next((mk for mk in MONTADORAS if nome.upper().startswith(mk)), None)
        modelo = nome[len(maker):].strip() if maker else nome
        out.append((maker, modelo or nome, nome, faixa))
    return out


def limpar_aplicacao(valor: str):
    """Remove o JS e o 'VER MAIS' do campo, deixando a lista legível."""
    if not valor:
        return None
    maquinas = parse_maquinas(valor)
    if maquinas:
        return " | ".join(dict.fromkeys(n for _, _, n, _ in maquinas))
    return re.sub(r"\s*\$\(function.*$", "", valor, flags=re.S).strip() or None


# mapa: chave da fonte -> coluna promovida + conversor
PROMOVIDAS = {
    "Diâmetro Interno":              ("diametro_interno_mm", to_mm),
    "Diâmetro Externo":              ("diametro_externo_mm", to_mm),
    "Largura":                       ("largura_mm", to_mm),
    "Altura":                        ("altura_mm", to_mm),
    "Comprimento":                   ("comprimento_mm", to_mm),
    "Espessura":                     ("espessura_mm", to_mm),
    "Peso Bruto":                    ("peso_kg", to_kg),
    "Capacidade de Carga Dinâmica":  ("carga_dinamica_n", to_newton),
    "Capacidade de Carga Estática":  ("carga_estatica_n", to_newton),
    "Velocidade Limite":             ("velocidade_limite_rpm", to_rpm),
    "Material":                      ("material", lambda v: v),
    "Tipo":                          ("tipo", lambda v: v),
    "Vedação":                       ("vedacao", lambda v: v),
}


# ---------------------------------------------------------------------
# Carga
# ---------------------------------------------------------------------
LOTE = 1000        # produtos por lote/commit


def gravar_lote(cur, pids, imagens, specs, maquinas, n_img, n_spec, n_pm):
    """Grava as tabelas filhas do lote em poucos round-trips.

    Apaga as filhas dos produtos do lote e reinsere: é o que torna a
    recarga idempotente (produto que perdeu uma foto na origem não fica
    com a foto velha pendurada).
    """
    if not pids:
        return n_img, n_spec, n_pm

    cur.execute("DELETE FROM product_image  WHERE product_id = ANY(%s)", (pids,))
    cur.execute("DELETE FROM product_spec   WHERE product_id = ANY(%s)", (pids,))
    cur.execute("DELETE FROM product_machine WHERE product_id = ANY(%s)", (pids,))

    if imagens:
        cur.executemany(
            "INSERT INTO product_image (product_id, url, position) "
            "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            imagens,
        )
        n_img += len(imagens)
    if specs:
        cur.executemany(
            "INSERT INTO product_spec "
            "(product_id, attr_key, attr_slug, attr_value, value_num, unit) "
            "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
            specs,
        )
        n_spec += len(specs)
    if maquinas:
        faixas = {}
        for pid, mid, faixa in maquinas:
            faixas.setdefault((pid, mid), set()).add(faixa or "")
        maquinas = [(pid, mid, " | ".join(sorted(f for f in fs if f)) or None)
                    for (pid, mid), fs in faixas.items()]
        cur.executemany(
            "INSERT INTO product_machine (product_id, machine_id, serial_range) "
            "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            maquinas,
        )
        n_pm += len(maquinas)

    pids.clear()
    imagens.clear()
    specs.clear()
    maquinas.clear()
    return n_img, n_spec, n_pm


def carregar(dsn: str, truncate: bool) -> None:
    arquivos = sorted(glob.glob(os.path.join(DATA_DIR, "*.json")))
    if not arquivos:
        sys.exit(f"nenhum JSON em {DATA_DIR}/")

    # O nome do arquivo é o departamento de origem (veio do sitemap daquela
    # categoria). Uns 70 produtos vêm com categoria1 vazia da fonte; sem
    # isso eles cairiam num departamento "" e sumiriam de qualquer filtro.
    registros = []
    for f in arquivos:
        dep = DEPARTAMENTOS.get(
            os.path.splitext(os.path.basename(f))[0],
            os.path.splitext(os.path.basename(f))[0],
        )
        with open(f, encoding="utf-8") as fh:
            for r in json.load(fh):
                if not (r.get("categoria1") or "").strip():
                    r["categoria1"] = dep
                registros.append(r)
    # A última ocorrência define também fotos e specs, inclusive no mesmo lote.
    registros = list({r["product_id"]: r for r in registros}.values())
    print(f"{len(registros)} produtos lidos de {len(arquivos)} arquivos")

    with psycopg.connect(dsn, autocommit=False) as conn:
        cur = conn.cursor()
        cur.execute("SET search_path TO imdepa, public")

        if truncate:
            cur.execute(
                "TRUNCATE product, product_image, product_spec, machine, "
                "product_machine, brand, category RESTART IDENTITY CASCADE"
            )
            print("tabelas zeradas")

        # ---------- marcas ----------
        marcas = {r["marca"].strip() for r in registros if r.get("marca", "").strip()}
        for nome in sorted(marcas):
            cur.execute(
                "INSERT INTO brand (name, slug) VALUES (%s, %s) "
                "ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name",
                (nome, slugify(nome)),
            )
        cur.execute("SELECT slug, id FROM brand")
        brand_id = dict(cur.fetchall())
        print(f"{len(brand_id)} marcas")

        # ---------- categorias (3 níveis) ----------
        cat_id = {}

        def upsert_cat(nome, parent, level):
            nome = (nome or "").strip()
            if not nome:
                return parent
            slug = slugify(nome)
            chave = (parent, slug)
            if chave in cat_id:
                return cat_id[chave]
            if parent is None:
                cur.execute(
                    "INSERT INTO category (parent_id, name, slug, level) "
                    "VALUES (NULL, %s, %s, %s) "
                    "ON CONFLICT (slug) WHERE parent_id IS NULL "
                    "DO UPDATE SET name = EXCLUDED.name RETURNING id",
                    (nome, slug, level),
                )
            else:
                cur.execute(
                    "INSERT INTO category (parent_id, name, slug, level) "
                    "VALUES (%s, %s, %s, %s) "
                    "ON CONFLICT (parent_id, slug) "
                    "DO UPDATE SET name = EXCLUDED.name RETURNING id",
                    (parent, nome, slug, level),
                )
            cat_id[chave] = cur.fetchone()[0]
            return cat_id[chave]

        for r in registros:
            c1 = upsert_cat(r.get("categoria1"), None, 1)
            c2 = upsert_cat(r.get("categoria2"), c1, 2) if c1 else None
            if c2 and c2 != c1:
                upsert_cat(r.get("categoria3"), c2, 3)
        print(f"{len(cat_id)} categorias")

        # ---------- máquinas ----------
        # chaveadas por slug: a fonte escreve a mesma máquina de formas
        # diferentes ("CASE IH A8800" / "CASE-IH A8800") e o slug funde as
        # duas grafias numa máquina só.
        maquinas = {}
        for r in registros:
            for maker, modelo, nome, _ in parse_maquinas(
                r.get("info_tecnica", {}).get("Aplicação Equipamentos", "")
            ):
                maquinas.setdefault(slugify(nome), (maker, modelo, nome))
        for slug, (maker, modelo, nome) in sorted(maquinas.items()):
            cur.execute(
                "INSERT INTO machine (maker, model, full_name, slug) "
                "VALUES (%s, %s, %s, %s) ON CONFLICT (slug) DO NOTHING",
                (maker, modelo, nome, slug),
            )
        cur.execute("SELECT slug, id FROM machine")
        machine_id = dict(cur.fetchall())
        print(f"{len(machine_id)} máquinas")

        # ---------- produtos ----------
        n_img = n_spec = n_pm = 0
        pids_lote, imagens_lote, specs_lote, maquinas_lote = [], [], [], []
        cur.execute("SELECT 1 FROM information_schema.columns WHERE table_schema='imdepa' AND table_name='product' AND column_name='medidas_do_titulo'")
        tem_proveniencia = cur.fetchone() is not None
        for i, r in enumerate(registros, 1):
            info = r.get("info_tecnica", {}) or {}

            # categoria mais específica preenchida
            c1 = cat_id.get((None, slugify(r.get("categoria1", "")))) if r.get("categoria1") else None
            c2 = cat_id.get((c1, slugify(r.get("categoria2", "")))) if c1 and r.get("categoria2") else None
            c3 = cat_id.get((c2, slugify(r.get("categoria3", "")))) if c2 and r.get("categoria3") else None
            categoria = c3 or c2 or c1

            promov = {}
            for chave, (coluna, conv) in PROMOVIDAS.items():
                if chave in info:
                    promov[coluna] = conv(info[chave])

            aplic_equip = limpar_aplicacao(info.get("Aplicação Equipamentos"))
            # spec cru: preserva tudo, mas com o campo de equipamentos limpo
            spec = dict(info)
            if aplic_equip:
                spec["Aplicação Equipamentos"] = aplic_equip

            cur.execute(
                """
                INSERT INTO product (
                    product_id, slug, url, nome, codigo, codigo_imdepa,
                    codigo_montadora, gtin, ncm, brand_id, category_id,
                    descricao, aplicacao, utilizacao,
                    diametro_interno_mm, diametro_externo_mm, largura_mm,
                    altura_mm, comprimento_mm, espessura_mm, peso_kg,
                    carga_dinamica_n, carga_estatica_n, velocidade_limite_rpm,
                    material, tipo, vedacao, spec, scraped_erro
                ) VALUES (
                    %(product_id)s, %(slug)s, %(url)s, %(nome)s, %(codigo)s,
                    %(codigo_imdepa)s, %(codigo_montadora)s, %(gtin)s, %(ncm)s,
                    %(brand_id)s, %(category_id)s, %(descricao)s, %(aplicacao)s,
                    %(utilizacao)s, %(di)s, %(de)s, %(lg)s, %(al)s, %(cp)s,
                    %(es)s, %(pk)s, %(cd)s, %(ce)s, %(vl)s, %(material)s,
                    %(tipo)s, %(vedacao)s, %(spec)s, %(erro)s
                )
                ON CONFLICT (product_id) DO UPDATE SET
                    slug = EXCLUDED.slug, url = EXCLUDED.url,
                    scraped_erro = EXCLUDED.scraped_erro,
                    nome = EXCLUDED.nome, codigo = EXCLUDED.codigo,
                    codigo_imdepa = EXCLUDED.codigo_imdepa,
                    codigo_montadora = EXCLUDED.codigo_montadora,
                    gtin = EXCLUDED.gtin, ncm = EXCLUDED.ncm,
                    brand_id = EXCLUDED.brand_id,
                    category_id = EXCLUDED.category_id,
                    descricao = EXCLUDED.descricao,
                    aplicacao = EXCLUDED.aplicacao,
                    utilizacao = EXCLUDED.utilizacao,
                    diametro_interno_mm = EXCLUDED.diametro_interno_mm,
                    diametro_externo_mm = EXCLUDED.diametro_externo_mm,
                    largura_mm = EXCLUDED.largura_mm,
                    altura_mm = EXCLUDED.altura_mm,
                    comprimento_mm = EXCLUDED.comprimento_mm,
                    espessura_mm = EXCLUDED.espessura_mm,
                    peso_kg = EXCLUDED.peso_kg,
                    carga_dinamica_n = EXCLUDED.carga_dinamica_n,
                    carga_estatica_n = EXCLUDED.carga_estatica_n,
                    velocidade_limite_rpm = EXCLUDED.velocidade_limite_rpm,
                    material = EXCLUDED.material, tipo = EXCLUDED.tipo,
                    vedacao = EXCLUDED.vedacao, spec = EXCLUDED.spec
                RETURNING id
                """,
                {
                    "product_id": r["product_id"],
                    "slug": r.get("slug") or slugify(r.get("nome", "")),
                    "url": r.get("url"),
                    "nome": r.get("nome") or r.get("codigo") or r["product_id"],
                    "codigo": r.get("codigo") or None,
                    "codigo_imdepa": info.get("Código Imdepa"),
                    "codigo_montadora": info.get("Código da Montadora"),
                    "gtin": r.get("gtin") or info.get("Código de barras") or "",
                    "ncm": info.get("NCM"),
                    "brand_id": brand_id.get(slugify(r.get("marca", ""))),
                    "category_id": categoria,
                    "descricao": r.get("descricao") or None,
                    "aplicacao": info.get("Aplicação"),
                    "utilizacao": info.get("Utilização") or aplic_equip,
                    "di": promov.get("diametro_interno_mm"),
                    "de": promov.get("diametro_externo_mm"),
                    "lg": promov.get("largura_mm"),
                    "al": promov.get("altura_mm"),
                    "cp": promov.get("comprimento_mm"),
                    "es": promov.get("espessura_mm"),
                    "pk": promov.get("peso_kg"),
                    "cd": promov.get("carga_dinamica_n"),
                    "ce": promov.get("carga_estatica_n"),
                    "vl": promov.get("velocidade_limite_rpm"),
                    "material": promov.get("material"),
                    "tipo": promov.get("tipo"),
                    "vedacao": promov.get("vedacao"),
                    "spec": Jsonb(spec),
                    "erro": r.get("erro") or None,
                },
            )
            pid = cur.fetchone()[0]
            if tem_proveniencia:
                cur.execute("UPDATE product SET medidas_do_titulo = false WHERE id = %s", (pid,))

            # As filhas são acumuladas e gravadas em lote (executemany).
            # Uma linha por round-trip derrubava o servidor: ~150 mil
            # comandos numa transação só geram checkpoints gigantes.
            pids_lote.append(pid)

            # imagens (dedup preservando ordem)
            vistas = []
            for url in r.get("imagens", []):
                if url and url not in vistas:
                    vistas.append(url)
            imagens_lote.extend((pid, url, pos) for pos, url in enumerate(vistas, 1))

            # specs chave/valor
            for chave, valor in spec.items():
                if valor is None or str(valor).strip() == "":
                    continue
                valor = str(valor)[:4000]
                vnum, unit = num_generico(valor, chave)
                specs_lote.append((pid, chave, slugify(chave), valor, vnum, unit))

            # máquinas compatíveis
            for _, _, nome, faixa in parse_maquinas(
                info.get("Aplicação Equipamentos", "")
            ):
                mid = machine_id.get(slugify(nome))
                if mid:
                    maquinas_lote.append((pid, mid, faixa))

            if i % LOTE == 0:
                n_img, n_spec, n_pm = gravar_lote(
                    cur, pids_lote, imagens_lote, specs_lote, maquinas_lote,
                    n_img, n_spec, n_pm,
                )
                conn.commit()
                print(f"  {i}/{len(registros)}...")

        n_img, n_spec, n_pm = gravar_lote(
            cur, pids_lote, imagens_lote, specs_lote, maquinas_lote,
            n_img, n_spec, n_pm,
        )
        conn.commit()
        print(f"produtos: {len(registros)} | imagens: {n_img} | "
              f"specs: {n_spec} | compatibilidades: {n_pm}")

        # Recupera medidas do título (migration 003). Fica aqui porque
        # precisa rodar DEPOIS de toda carga: a carga sobrescreve as
        # colunas de medida com o que a fonte declara, e é este passo que
        # preenche os buracos — sem ele a largura cai de 3.514 para 760.
        cur.execute("SELECT to_regprocedure('imdepa.medidas_do_nome(text)')")
        if cur.fetchone()[0] is None:
            print("AVISO: migration 003 não aplicada — medidas do título não "
                  "serão recuperadas (rode sql/migrations/003_*.sql)")
        else:
            cur.execute(
                """
                WITH extraido AS (
                    SELECT id, imdepa.medidas_do_nome(nome) AS m
                    FROM product
                    WHERE imdepa.medidas_do_nome(nome) IS NOT NULL
                )
                UPDATE product p
                   SET diametro_interno_mm = COALESCE(p.diametro_interno_mm, e.m[1]),
                       diametro_externo_mm = COALESCE(p.diametro_externo_mm, e.m[2]),
                       largura_mm          = COALESCE(p.largura_mm,          e.m[3]),
                       medidas_do_titulo   = TRUE
                  FROM extraido e
                 WHERE p.id = e.id
                   AND (p.diametro_interno_mm IS NULL
                     OR p.diametro_externo_mm IS NULL
                     OR p.largura_mm IS NULL)
                """
            )
            print(f"medidas recuperadas do título: {cur.rowcount}")
        conn.commit()

        cur.execute("SELECT imdepa.refresh_catalogo()")
        conn.commit()
        print("views materializadas atualizadas")


def main() -> None:
    ap = argparse.ArgumentParser(description="Carrega o catálogo Imdepa no Postgres")
    ap.add_argument("--dsn", default=DEFAULT_DSN)
    ap.add_argument("--truncate", action="store_true", help="zera as tabelas antes")
    args = ap.parse_args()
    carregar(args.dsn, args.truncate)


if __name__ == "__main__":
    main()
