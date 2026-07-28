#!/usr/bin/env python3
"""
Validação end-to-end num Postgres real EMBARCADO (pgserver), tudo no mesmo processo:
  1) sobe Postgres, cria catalogo_db
  2) aplica schema.sql (sem extensões unaccent/pg_trgm que o pg embarcado não traz)
  3) carrega geomaq_parts.csv (reusa scripts/load.py)
  4) roda queries de verificação
"""
import os, re, sys, pgserver, psycopg2
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE,"scripts"))

pgdata="/tmp/pgdata_val"; os.makedirs(pgdata, exist_ok=True)
srv=pgserver.get_server(pgdata); host=pgdata

# 1) db
c=psycopg2.connect(host=host, dbname="postgres", user="postgres"); c.autocommit=True
cur=c.cursor(); cur.execute("SELECT 1 FROM pg_database WHERE datname='catalogo_db'")
if not cur.fetchone(): cur.execute("CREATE DATABASE catalogo_db")
c.close()

# 2) schema (sanitizado p/ pg embarcado)
c=psycopg2.connect(host=host, dbname="catalogo_db", user="postgres"); c.autocommit=True; cur=c.cursor()
cur.execute("DROP SCHEMA IF EXISTS catalogo CASCADE")
sql=open(os.path.join(BASE,"sql","schema.sql")).read()
sql=re.sub(r"CREATE EXTENSION[^;]*;","",sql)
sql=re.sub(r"CREATE INDEX[^;]*gin_trgm_ops[^;]*;","",sql)
cur.execute(sql); c.close()
print("[ok] schema aplicado")

# 3) carga
os.environ["DATABASE_URL"]="postgresql://postgres@/catalogo_db?host=%s"%host
import load
sys.argv=["load.py", os.path.join(BASE,"data","geomaq_parts.csv")]
load.main()

# 4) verificação
c=psycopg2.connect(host=host, dbname="catalogo_db", user="postgres"); cur=c.cursor()
cur.execute("SET search_path TO catalogo, public")
def q(sql):
    cur.execute(sql); return cur.fetchall()

print("\n===== VERIFICAÇÃO =====")
print("brands       :", q("SELECT count(*) FROM brand")[0][0])
print("linhas       :", q("SELECT count(*) FROM product_line")[0][0])
print("familias     :", q("SELECT count(*) FROM product_family")[0][0])
print("produtos     :", q("SELECT count(*) FROM product")[0][0])
print("atributos    :", q("SELECT count(*) FROM product_attribute")[0][0])
print("imagens      :", q("SELECT count(*) FROM product_image")[0][0])
print("p/ revisar   :", q("SELECT count(*) FROM product WHERE needs_review")[0][0])

print("\nProdutos por linha:")
for l,n in q("""SELECT pl.name, count(*) FROM product p
                JOIN product_line pl ON pl.id=p.product_line_id
                GROUP BY pl.name ORDER BY pl.name"""):
    print(f"   {l:12} {n}")

print("\nTop famílias:")
for f,n in q("""SELECT f.name, count(*) FROM product p
                JOIN product_family f ON f.id=p.family_id
                GROUP BY f.name ORDER BY count(*) DESC LIMIT 8"""):
    print(f"   {f:16} {n}")

print("\nIntegridade FK (produtos sem marca):",
      q("SELECT count(*) FROM product p LEFT JOIN brand b ON b.id=p.brand_id WHERE b.id IS NULL")[0][0])
print("Produtos sem imagem:",
      q("""SELECT count(*) FROM product p LEFT JOIN product_image i ON i.product_id=p.id
           WHERE i.id IS NULL""")[0][0])

print("\nExemplo (view achatada):")
for row in q("""SELECT marca,linha,familia,sku,nome,extraction_source,needs_review,imagem
                FROM v_product_full WHERE nome IS NOT NULL ORDER BY random() LIMIT 5"""):
    print("  ", row)
c.close()
print("\n[ok] validação concluída")
