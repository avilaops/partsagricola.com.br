#!/usr/bin/env python3
"""
Carrega geomaq_parts.csv no Postgres (schema catalogo).
Uso:
    DATABASE_URL=postgresql://user:pass@host:5432/db python3 load.py [csv]
    (ou passe --uri). Assume que schema.sql já foi aplicado.
"""
import os, sys, csv, re, unicodedata
import psycopg2

CSV_DEFAULT = os.path.join(os.path.dirname(__file__), "..", "data", "geomaq_parts.csv")

def slug(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii","ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+","_", s).strip("_").lower() or "x"

def specs_to_attrs(specs):
    """Converte tokens de spec em pares (chave, valor, unidade)."""
    out = []
    for tok in [t.strip() for t in (specs or "").split(";") if t.strip()]:
        m = re.match(r"^Z(\d+)$", tok, re.I) or re.match(r"^(\d+)Z$", tok, re.I)
        if m:
            out.append(("dentes", m.group(1), "Z")); continue
        m = re.match(r"^(\d+[.,]?\d*)(MM|CM|POL)$", tok, re.I)
        if m:
            out.append(("dimensao", m.group(1).replace(",","."), m.group(2).lower())); continue
        if re.match(r"^\d+/\d+$", tok) or re.match(r"^\d+\.\d+/\d+$", tok):
            out.append(("medida_fracionaria", tok, None)); continue
        out.append(("spec", tok, None))
    return out

def get_or_create(cur, table, where, insert):
    cols = ", ".join(where.keys())
    vals = list(where.values())
    ph   = " AND ".join(f"{k}=%s" for k in where)
    cur.execute(f"SELECT id FROM {table} WHERE {ph}", vals)
    r = cur.fetchone()
    if r: return r[0]
    icols = ", ".join(insert.keys())
    iph   = ", ".join(["%s"]*len(insert))
    cur.execute(f"INSERT INTO {table} ({icols}) VALUES ({iph}) RETURNING id",
                list(insert.values()))
    return cur.fetchone()[0]

def main():
    uri = os.environ.get("DATABASE_URL") or (sys.argv[2] if "--uri" in sys.argv else None)
    csv_path = sys.argv[1] if len(sys.argv)>1 and not sys.argv[1].startswith("--") else CSV_DEFAULT
    if not uri:
        print("Defina DATABASE_URL"); sys.exit(1)

    conn = psycopg2.connect(uri); conn.autocommit = False
    cur = conn.cursor(); cur.execute("SET search_path TO catalogo, public")

    with open(csv_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    n_prod=n_attr=n_img=0
    for r in rows:
        marca = r["marca"].strip() or "Desconhecida"
        brand_id = get_or_create(cur, "brand",
            {"slug": slug(marca)},
            {"name": marca, "slug": slug(marca), "segment": "agricola"})

        line_id = None
        if r["linha"].strip():
            line_id = get_or_create(cur, "product_line",
                {"brand_id": brand_id, "slug": slug(r["linha"])},
                {"brand_id": brand_id, "name": r["linha"].strip(),
                 "slug": slug(r["linha"]), "catalog_year": 2025,
                 "source_file": r.get("arquivo","")})

        fam_id = None
        if r["familia"].strip():
            fam_id = get_or_create(cur, "product_family",
                {"slug": slug(r["familia"])},
                {"name": r["familia"].strip(), "slug": slug(r["familia"])})

        # produto (idempotente por (brand,line,sku))
        cur.execute("""INSERT INTO product
            (brand_id, product_line_id, family_id, sku, name, application,
             source_file, source_page, extraction_source, ocr_confidence,
             needs_review, review_reason)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (brand_id, product_line_id, sku) DO UPDATE
              SET name=EXCLUDED.name, application=EXCLUDED.application,
                  needs_review=EXCLUDED.needs_review
            RETURNING id""",
            (brand_id, line_id, fam_id, r["codigo"].strip(), r["nome"].strip() or None,
             r["aplicacao"].strip() or None, r.get("arquivo",""),
             int(r["pagina"]) if r["pagina"] else None,
             r.get("fonte") or None,
             float(r["ocr_conf"]) if r.get("ocr_conf") else None,
             r.get("revisar")=="sim", r.get("revisar_motivo") or None))
        pid = cur.fetchone()[0]; n_prod+=1

        # atributos técnicos (specs)
        cur.execute("DELETE FROM product_attribute WHERE product_id=%s", (pid,))
        for k,v,u in specs_to_attrs(r.get("specs","")):
            cur.execute("""INSERT INTO product_attribute (product_id, attr_key, attr_value, unit)
                           VALUES (%s,%s,%s,%s)""", (pid,k,v,u)); n_attr+=1

        # imagem
        if r.get("imagem"):
            cur.execute("SELECT 1 FROM product_image WHERE product_id=%s AND path=%s",
                        (pid, r["imagem"]))
            if not cur.fetchone():
                cur.execute("""INSERT INTO product_image (product_id, path, kind, source_page, is_primary)
                               VALUES (%s,%s,'cell',%s,TRUE)""",
                            (pid, r["imagem"], int(r["pagina"]) if r["pagina"] else None))
                n_img+=1

    conn.commit()
    print(f"OK: {n_prod} produtos, {n_attr} atributos, {n_img} imagens")
    cur.close(); conn.close()

if __name__ == "__main__":
    main()
