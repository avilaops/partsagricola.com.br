#!/usr/bin/env python3
"""
Extração completa dos catálogos Geomaq (Linha Algodão, Amendoim, Construção, Verde).
- Amendoim: PDF de texto  -> pdfplumber.extract_words + render pdftoppm p/ recorte
- Demais:   páginas-imagem -> JPEG embutido + OCR (tesseract por) p/ texto e recorte

Saídas:
  data/geomaq_parts.json  (registros brutos + specs + caminho da imagem)
  data/geomaq_parts.csv
  images/<linha>/<linha>_<pag>_<col>_<code>.png  (recorte da célula = foto+nome+código)

Uso: TESSDATA_PREFIX=/tmp python3 extract_all.py
"""
import os, re, io, csv, json, glob, subprocess, unicodedata
import pdfplumber
from PIL import Image, ImageOps, ImageFilter, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True
import pytesseract

UPLOADS = "/sessions/gracious-admiring-wright/mnt/uploads"
OUT     = "/sessions/gracious-admiring-wright/mnt/outputs/agricola"
IMG_DIR = os.path.join(OUT, "images")
DATA_DIR= os.path.join(OUT, "data")

import extract_common as EC

MARCA = "Geomaq"
LINHA_FROM_FILE = [
    ("Algod", "Algodão"), ("Amendoim", "Amendoim"),
    ("Constru", "Construção"), ("Verde", "Verde"),
]

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")
    return s or "x"

def linha_de_arquivo(fname):
    for key, val in LINHA_FROM_FILE:
        if key.lower() in fname.lower():
            return val
    return "Desconhecida"

def familia_de_nome(name):
    """Família = primeira palavra significativa do nome (ROLAMENTO, CORREIA...)."""
    toks = [t for t in re.split(r"\s+", name.strip()) if len(t) >= 3 and t.isalpha()]
    return toks[0].upper() if toks else ""

MEDIDA_RE = re.compile(
    r"\b(\d+[.,]?\d*\s?(?:MM|CM|POL|X\d+MM)|\d+/\d+|Z\d+|\d+X\d+MM?|\d+B?X\d+MM|F\d+|60/\d)\b",
    re.I)
def specs_de_nome(name):
    return sorted(set(m.group(0).upper().replace(" ", "") for m in MEDIDA_RE.finditer(name)))

def aplicacao_de_texto(full_text):
    m = re.search(r"COLHEDORAS?\s+DE\s+([A-ZÁÂÃÉÊÍÓÔÕÚÇ ]+?)(?:\n|$)", full_text or "", re.I)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip().title()
    return ""

# ---------- rasterização ----------
def render_text_page(pdf_path, page_index, dpi=200):
    """Renderiza uma página (1-based = page_index+1) com pdftoppm -> PIL RGB. scale=dpi/72."""
    prefix = f"/tmp/rp_{os.getpid()}"
    subprocess.run(["pdftoppm", "-png", "-r", str(dpi),
                    "-f", str(page_index+1), "-l", str(page_index+1),
                    pdf_path, prefix],
                   check=True, capture_output=True)
    cands = glob.glob(prefix + "*.png")
    if not cands:
        return None, None
    im = Image.open(cands[0]).convert("RGB")
    for c in cands: os.remove(c)
    return im, dpi/72.0

def embedded_jpeg(page):
    """Retorna PIL da imagem full-page embutida (DCTDecode) de uma página-imagem."""
    best = None
    for im in page.images:
        try:
            st = im["stream"]
            w = int(st.attrs.get("Width", 0)); h = int(st.attrs.get("Height", 0))
            if w >= page.width and h >= page.height*0.9:
                best = st
                break
        except Exception:
            continue
    if best is None and page.images:
        best = page.images[0]["stream"]
    if best is None:
        return None
    raw = best.get_data()
    try:
        return Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        return None

# ---------- OCR ----------
def ocr_words(pil_img, upscale=2.5, lang="por", conf_min=30):
    """Retorna (words, mean_conf). words em coords do RASTER ORIGINAL (px)."""
    g = pil_img.convert("L")
    w, h = g.size
    big = g.resize((int(w*upscale), int(h*upscale)), Image.LANCZOS)
    big = ImageOps.autocontrast(big)
    big = big.filter(ImageFilter.SHARPEN)
    data = pytesseract.image_to_data(big, lang=lang, config="--psm 6",
                                     output_type=pytesseract.Output.DICT)
    words, confs = [], []
    for i, txt in enumerate(data["text"]):
        t = (txt or "").strip()
        if not t:
            continue
        try: c = float(data["conf"][i])
        except: c = -1
        if c < conf_min:
            continue
        x = data["left"][i]/upscale; y = data["top"][i]/upscale
        ww = data["width"][i]/upscale; hh = data["height"][i]/upscale
        words.append({"text": t, "x0": x, "top": y, "x1": x+ww, "bottom": y+hh, "conf": c})
        confs.append(c)
    mean_conf = round(sum(confs)/len(confs), 1) if confs else 0.0
    return words, mean_conf

# ---------- recorte de células ----------
def cluster_rows(parts, tol):
    tops = sorted(set(round(p["code_top"]) for p in parts))
    rows = []
    for t in tops:
        if rows and t - rows[-1][-1] <= tol:
            rows[-1].append(t)
        else:
            rows.append([t])
    return [ (min(r), max(r)) for r in rows ]

def crop_cell(raster, scale, part, page_w_units, page_h_units, ncols, rows, pad_frac=0.02):
    """Recorta a célula (coluna x banda-de-linha) da peça no raster."""
    band_w = page_w_units / ncols
    x0 = part["col"] * band_w
    x1 = (part["col"]+1) * band_w
    # banda vertical: da linha anterior (ou header) até um pouco abaixo do código
    ct = part["code_top"]
    row_i = next((i for i,(a,b) in enumerate(rows) if a-2 <= round(ct) <= b+2), 0)
    top = (rows[row_i-1][1] + 8) if row_i > 0 else page_h_units*0.14
    bottom = ct + page_h_units*0.03
    px = page_w_units*pad_frac
    box = (max(0,(x0-px))*scale, max(0,top)*scale,
           min(page_w_units,(x1+px))*scale, min(page_h_units,bottom)*scale)
    box = tuple(int(v) for v in box)
    if box[2]-box[0] < 5 or box[3]-box[1] < 5:
        return None
    return raster.crop(box)

# ---------- pipeline ----------
def process_pdf(pdf_path, records, pg_lo=1, pg_hi=9999):
    fname = os.path.basename(pdf_path)
    linha = linha_de_arquivo(fname)
    lslug = slug(linha)
    os.makedirs(os.path.join(IMG_DIR, lslug), exist_ok=True)
    n = 0
    with pdfplumber.open(pdf_path) as pdf:
        for pi, pg in enumerate(pdf.pages):
            if not (pg_lo <= pi+1 <= pg_hi):
                continue
            native_text = pg.extract_text() or ""
            is_text = len(native_text.strip()) > 20
            page_no = pi + 1

            if is_text:
                if EC.is_excluded_page(native_text):
                    continue
                words = [{"text":w["text"],"x0":w["x0"],"top":w["top"],
                          "x1":w["x1"],"bottom":w["bottom"]} for w in pg.extract_words()]
                pw, ph = pg.width, pg.height
                source = "text"; conf = 100.0
                raster, scale = render_text_page(pdf_path, pi, dpi=200)
                if raster is None:
                    scale = 1.0
                aplicacao = aplicacao_de_texto(native_text)
            else:
                raster = embedded_jpeg(pg)
                if raster is None:
                    continue
                pw, ph = raster.size          # coords em px do raster
                scale = 1.0
                words, conf = ocr_words(raster)
                full_ocr = " ".join(w["text"] for w in words)
                if EC.is_excluded_page(full_ocr):
                    continue
                source = "ocr"
                aplicacao = aplicacao_de_texto(full_ocr)

            y_tol = max(6, ph*0.009)
            parts = EC.parse_page(words, pw, ph, ncols=4, y_tol=y_tol)
            # página é de peças se tiver ao menos 2 códigos detectados
            if len(parts) < 2:
                continue
            rows = cluster_rows(parts, tol=max(10, ph*0.02))

            for p in parts:
                code = p["code"].strip()
                name = p["name"].strip()
                img_rel = ""
                if raster is not None:
                    crop = crop_cell(raster, scale, p, pw, ph, 4, rows)
                    if crop is not None:
                        safe = slug(code)[:40]
                        fn = f"{lslug}_p{page_no:02d}_c{p['col']}_{safe}.png"
                        crop.save(os.path.join(IMG_DIR, lslug, fn))
                        img_rel = f"images/{lslug}/{fn}"
                records.append({
                    "marca": MARCA,
                    "linha": linha,
                    "familia": familia_de_nome(name),
                    "codigo": code,
                    "nome": name,
                    "aplicacao": aplicacao,
                    "specs": "; ".join(specs_de_nome(name)),
                    "preco": "",                       # catálogos não trazem preço
                    "pagina": page_no,
                    "arquivo": fname,
                    "fonte": source,
                    "ocr_conf": conf if source=="ocr" else "",
                    "imagem": img_rel,
                })
                n += 1
    return n

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    match = os.environ.get("MATCH", "")            # substring do arquivo
    pages = os.environ.get("PAGES", "")            # "A-B"
    pg_lo, pg_hi = 1, 9999
    if pages:
        a, b = pages.split("-"); pg_lo, pg_hi = int(a), int(b)
    pdfs = sorted(glob.glob(os.path.join(UPLOADS, "*.pdf")))
    if match:
        pdfs = [p for p in pdfs if match.lower() in os.path.basename(p).lower()]
    records = []
    for p in pdfs:
        c = process_pdf(p, records, pg_lo, pg_hi)
        print(f"{os.path.basename(p)} [p{pg_lo}-{pg_hi}]: {c} peças", flush=True)
    # saída parcial por-catálogo (append-safe)
    tag = slug(match) if match else "all"
    if pages: tag += f"_{pg_lo}_{pg_hi}"
    with open(os.path.join(DATA_DIR, f"parts_{tag}.json"), "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print("PARCIAL:", len(records), "->", f"parts_{tag}.json")

if __name__ == "__main__":
    main()
