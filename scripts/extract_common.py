"""
Extração comum para catálogos Geomaq (layout em grade: NOME + CÓDIGO por célula).
Funciona tanto para PDFs de texto (pdfplumber) quanto image-only (OCR via tesseract).

Cada 'palavra' é um dict: {text, x0, top, x1, bottom} (coords em pontos/px da página).
O parser agrupa palavras em colunas (x) e associa cada bloco de NOME ao CÓDIGO
mais próximo abaixo, na mesma coluna.
"""
import re

# Linhas de cabeçalho/rodapé a ignorar
NOISE_PATTERNS = [
    re.compile(r"PE[ÇC]AS?\s+DE\s+REPOSI", re.I),
    re.compile(r"COLHEDORAS?\s+DE", re.I),
    re.compile(r"geomaq", re.I),
    re.compile(r"www\.", re.I),
    re.compile(r"^/?@?geo", re.I),
    re.compile(r"tratorpecas", re.I),
    re.compile(r"NOSSAS\s+FILIAIS", re.I),
    re.compile(r"HIST[ÓO]RIA", re.I),
    re.compile(r"DIVIS[ÃA]O", re.I),
    re.compile(r"cat[áa]logo", re.I),
    re.compile(r"^\d{4}$"),                 # ano "2025"
    re.compile(r"INFFINITY|INFINITY", re.I),
    re.compile(r"JOHN\s+DEERE", re.I),      # subtítulo (não é peça)
]

# Um "código" é um token alfanumérico, com pelo menos um dígito, sem espaço.
CODE_RE = re.compile(r"^[A-Z0-9][A-Z0-9\.\-/]{3,}$")

# Tokens isolados (palavra única) que são ruído de cabeçalho/rodapé
NOISE_TOKENS = {
    "PEÇAS", "PECAS", "PEÇA", "PEC", "AS", "DE", "REPOSIÇÃO", "REPOSICAO",
    "PARA", "COLHEDORAS", "COLHEDORA", "AMENDOIM", "ALGODÃO", "ALGODAO",
    "VERDE", "CONSTRUÇÃO", "CONSTRUCAO", "JOHN", "DEERE", "|", "FILIAIS",
    "BRASIL", "UNIDOS", "ESTADOS",
}

# padrões de telefone p/ rejeitar como código
PHONE_RE = re.compile(r"^\+?\d{2,4}[-\s]?\d{3,4}-\d{3,4}$")

def is_noise(text):
    t = text.strip()
    if not t:
        return True
    if t.upper() in NOISE_TOKENS:
        return True
    for p in NOISE_PATTERNS:
        if p.search(t):
            return True
    return False

def is_excluded_page(full_text):
    """Páginas que NUNCA são de peças (capa, história, filiais, índice)."""
    up = (full_text or "").upper()
    for kw in ("FILIAIS", "HISTÓRIA", "HISTORIA", "SUCESSO", "MISSÃO", "MISSAO",
               "SUMÁRIO", "SUMARIO", "ÍNDICE", "INDICE"):
        if kw in up:
            return True
    return False

# spec/medida (para preservar no nome ao limpar)
SPEC_KEEP_RE = re.compile(
    r"^(?:Z\d+|\d+Z|\d+/\d+|\d+\.\d+(?:/\d+)?|\d+X\d+MM?|\d+B?X\d+MM|F\d+|"
    r"\d+[.,]?\d*(?:MM|CM|POL)|\d+/\d)$", re.I)

def clean_name(text):
    """Mantém só tokens de rótulo (CAIXA-ALTA alfabético) e medidas; remove lixo de OCR."""
    out = []
    for t in text.split():
        t2 = t.strip(" .;:,·|—-")
        if not t2:
            continue
        if t2.isalpha() and t2.isupper() and len(t2) >= 2:   # rótulo em caixa-alta
            out.append(t2)
        elif SPEC_KEEP_RE.match(t2):                          # medida/spec
            out.append(t2.upper())
    return re.sub(r"\s+", " ", " ".join(out)).strip()

def looks_like_code(text):
    t = text.strip().replace(" ", "")
    if not CODE_RE.match(t):
        return False
    if not re.search(r"\d", t):        # precisa ter dígito
        return False
    # medidas: "8X8MM","25MM","70MM","1.38POL","100MM","3C","F40" -> spec, não código
    if re.search(r"\d\s*(MM|CM|POL)$", t, re.I):
        return False
    if PHONE_RE.match(t):              # telefone
        return False
    return True

def _colof(cx, page_width, ncols):
    return min(ncols - 1, max(0, int(cx // (page_width / ncols))))

def _group_lines_in_column(colwords, y_tol):
    """Dentro de UMA coluna, agrupa palavras em linhas por proximidade vertical."""
    ws = sorted(colwords, key=lambda w: w["top"])
    lines = []
    for w in ws:
        if lines and abs(lines[-1]["top_ref"] - w["top"]) <= y_tol:
            lines[-1]["words"].append(w)
        else:
            lines.append({"top_ref": w["top"], "words": [w]})
    out = []
    for ln in lines:
        ws2 = sorted(ln["words"], key=lambda w: w["x0"])
        out.append({
            "text": " ".join(x["text"] for x in ws2),
            "top": min(x["top"] for x in ws2),
            "cx": sum((x["x0"] + x["x1"]) / 2 for x in ws2) / len(ws2),
            "tokens": [x["text"] for x in ws2],
        })
    return out

def parse_page(words, page_width, page_height, ncols=4, y_tol=6,
               header_frac=0.14, footer_frac=0.90):
    """
    Retorna lista de peças: {code, name, col, code_top, code_cx}.
    Estratégia COLUNA-PRIMEIRO: atribui cada palavra a uma coluna (x),
    agrupa por linha dentro da coluna, e percorre de cima p/ baixo
    acumulando NOMES até encontrar um CÓDIGO (nome fica ACIMA da foto/código).
    Corta faixa de cabeçalho (top) e rodapé (bottom) por fração da altura.
    """
    top_cut = page_height * header_frac
    bot_cut = page_height * footer_frac
    # atribui coluna a cada palavra
    cols = {c: [] for c in range(ncols)}
    for w in words:
        if is_noise(w["text"]):
            continue
        if w["top"] < top_cut or w["top"] > bot_cut:
            continue
        cx = (w["x0"] + w["x1"]) / 2
        cols[_colof(cx, page_width, ncols)].append(w)

    parts = []
    for c in range(ncols):
        if not cols[c]:
            continue
        lines = _group_lines_in_column(cols[c], y_tol)
        buf = []          # nomes acumulados
        for ln in lines:
            toks = [t for t in ln["tokens"] if t.strip()]
            if toks and all(looks_like_code(t) for t in toks):
                # linha de código(s) -> emite uma peça por código
                for t in toks:
                    name = clean_name(" ".join(buf))
                    parts.append({
                        "code": t.strip(), "name": name, "col": c,
                        "code_top": ln["top"], "code_cx": ln["cx"],
                    })
                    # se houver múltiplos códigos numa linha, o nome vale p/ todos
                buf = []
            elif not is_noise(ln["text"]):
                buf.append(ln["text"])
    parts.sort(key=lambda p: (round(p["code_top"] / 10), p["col"]))
    return parts
