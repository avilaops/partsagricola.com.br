#!/usr/bin/env python3
"""Consolida as parciais parts_*.json em geomaq_parts.json + geomaq_parts.csv (dedup)."""
import glob, json, csv, os, collections

DATA = "/sessions/gracious-admiring-wright/mnt/outputs/agricola/data"
COLS = ["marca","linha","familia","codigo","nome","aplicacao","specs",
        "preco","pagina","arquivo","fonte","ocr_conf","imagem",
        "revisar","revisar_motivo"]

def flag_revisao(r):
    motivos = []
    if len(r.get("nome","").strip()) < 4:
        motivos.append("nome ausente/curto")
    try:
        if r.get("fonte")=="ocr" and float(r.get("ocr_conf") or 0) < 70:
            motivos.append("OCR baixa confiança")
    except Exception:
        pass
    return ("sim" if motivos else "nao"), "; ".join(motivos)

recs = []
for fp in sorted(glob.glob(os.path.join(DATA, "parts_*.json"))):
    with open(fp, encoding="utf-8") as f:
        recs.extend(json.load(f))

# dedup por (arquivo,pagina,codigo,col aproximado via imagem)
seen, out = set(), []
for r in recs:
    key = (r["arquivo"], r["pagina"], r["codigo"], r.get("imagem",""))
    if key in seen:
        continue
    seen.add(key)
    out.append(r)

for r in out:
    r["revisar"], r["revisar_motivo"] = flag_revisao(r)

out.sort(key=lambda r: (r["linha"], r["pagina"], r["codigo"]))

with open(os.path.join(DATA, "geomaq_parts.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
with open(os.path.join(DATA, "geomaq_parts.csv"), "w", encoding="utf-8", newline="") as f:
    wr = csv.DictWriter(f, fieldnames=COLS); wr.writeheader()
    for r in out: wr.writerow({k: r.get(k,"") for k in COLS})

por_linha = collections.Counter(r["linha"] for r in out)
por_fonte = collections.Counter(r["fonte"] for r in out)
com_img = sum(1 for r in out if r["imagem"])
revisar = sum(1 for r in out if r["revisar"]=="sim")
print("TOTAL:", len(out))
print("Por linha:", dict(por_linha))
print("Por fonte:", dict(por_fonte))
print("Com imagem:", com_img, "| Para revisar:", revisar)
print("Revisar por linha:", dict(collections.Counter(r["linha"] for r in out if r["revisar"]=="sim")))
