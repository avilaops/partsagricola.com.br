#!/usr/bin/env python3
"""
Raspagem do catálogo da Imdepa (loja.imdepa.com.br) — versão 2, completa.

A versão 1 (jul/2026) tirava só og:title e og:image e nunca chegou a rodar
até o fim (data/imdepa_partial ficou vazio) — o catálogo seguiu sem a Imdepa.
Esta versão pega TUDO que a página entrega renderizada no servidor (a loja é
CWS/Jet, SSR): nome, marca, código do fabricante, id, categorias (3 níveis),
descrição, tabela de informações técnicas (marca, NCM, peso, código Imdepa,
aplicação, medidas quando há), todas as fotos em tamanho grande e GTIN. Preço
não vem (a loja só mostra a quem está logado) — no site fica "sob consulta".

Lista de produtos: os 18 sitemaps por categoria já baixados em
data/scrapers/imdepa_sitemaps/ (12.502 URLs). Salva por categoria em
data/imdepa/<categoria>.json (retomável) e junta tudo em data/imdepa.json.

    python data/scrapers/scrape_imdepa.py            # tudo
    python data/scrapers/scrape_imdepa.py aneis      # só uma categoria
"""
import gzip
import html
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

import requests

SITEMAP_DIR = "data/scrapers/imdepa_sitemaps"
OUT_DIR = "data/imdepa"
CATEGORIES = [
    "rolamentos", "retentores", "vedacoes", "mancais", "correias", "aneis",
    "arruelas", "buchas", "correntes", "embreagens", "engrenagem", "esteiras",
    "ferramentas", "lubrificante", "mangueiras-e-terminais",
    "pecas-automotivas", "porcas", "rotulas",
]
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}
WORKERS = 6
MAX_RETRIES = 3

RE = {
    "h1": re.compile(r'<h1[^>]*class="product__name"[^>]*>(.*?)</h1>', re.S),
    "partcode": re.compile(r'class="product__partcode">\s*(?:C[óo]d\.\s*)?([^<]+?)\s*<'),
    "brand": re.compile(r'itemprop="brand"[^>]*>\s*<meta itemprop="name" content="([^"]*)"'),
    "gtin": re.compile(r'itemprop="gtin13" content="([^"]*)"'),
    "descricao": re.compile(r'class="panel-body panel-description">(.*?)</div>', re.S),
    "info": re.compile(r'id="collapseInfo".*?<table class="table-specifications">(.*?)</table>', re.S),
    "linha_info": re.compile(r"<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>", re.S),
    "img_gg": re.compile(r'https://images\.cws\.digital/produtos/gg/[^"\'\s]+'),
    "og_image": re.compile(r'property="og:image" content="([^"]*)"'),
    "cat1": re.compile(r'data-sku-category="([^"]*)"'),
    "cat2": re.compile(r'data-sku-category2="([^"]*)"'),
    "cat3": re.compile(r'data-sku-category3="([^"]*)"'),
    "meta_desc": re.compile(r'itemprop="description" content="([^"]*)"'),
}


def limpar(texto: str) -> str:
    texto = re.sub(r"<[^>]+>", " ", texto or "")
    return re.sub(r"\s+", " ", html.unescape(texto)).strip()


def urls_from_sitemap(category: str):
    path = os.path.join(SITEMAP_DIR, f"imdepa_{category}.xml.gz")
    with gzip.open(path, "rt", encoding="utf-8") as f:
        content = f.read()
    items = []
    for url in re.findall(r"<loc>([^<]+)</loc>", content):
        parts = urlparse(url).path.strip("/").split("/")
        if len(parts) >= 3 and parts[0] == "p":
            items.append({"url": url, "product_id": parts[1], "slug": parts[2]})
    return items


def extrair(html_pagina: str, item: dict) -> dict:
    def um(chave):
        m = RE[chave].search(html_pagina)
        return limpar(m.group(1)) if m else ""

    info = {}
    m = RE["info"].search(html_pagina)
    if m:
        for th, td in RE["linha_info"].findall(m.group(1)):
            k, v = limpar(th), limpar(td)
            if k and v:
                info[k] = v
    imagens = list(dict.fromkeys(RE["img_gg"].findall(html_pagina)))
    if not imagens:
        og = RE["og_image"].search(html_pagina)
        if og:
            imagens = [og.group(1)]
    return {
        **item,
        "nome": um("h1"),
        "marca": um("brand"),
        "codigo": um("partcode"),
        "gtin": um("gtin"),
        "categoria1": um("cat1"),
        "categoria2": um("cat2"),
        "categoria3": um("cat3"),
        "descricao": um("descricao") or um("meta_desc"),
        "info_tecnica": info,
        "imagens": imagens,
        "erro": "",
    }


def fetch_one(session: requests.Session, item: dict) -> dict:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(item["url"], headers=HEADERS, timeout=25)
            if resp.status_code != 200:
                return {**item, "erro": f"HTTP {resp.status_code}"}
            dados = extrair(resp.text, item)
            if not dados["nome"]:
                dados["erro"] = "sem nome (página mudou?)"
            return dados
        except requests.RequestException as e:
            if attempt == MAX_RETRIES:
                return {**item, "erro": str(e)[:160]}
            time.sleep(min(2 ** attempt, 10))
    return {**item, "erro": "esgotou tentativas"}


def scrape_category(category: str):
    out_path = os.path.join(OUT_DIR, f"{category}.json")
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as f:
            data = json.load(f)
        print(f"[{category}] já coletado: {len(data)} produtos", flush=True)
        return data

    items = urls_from_sitemap(category)
    print(f"[{category}] {len(items)} URLs, buscando…", flush=True)
    results, done, inicio = [], 0, time.time()
    with requests.Session() as session, ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(fetch_one, session, it) for it in items]
        for future in as_completed(futures):
            results.append(future.result())
            done += 1
            if done % 500 == 0:
                print(f"[{category}] {done}/{len(items)} ({time.time() - inicio:.0f}s)", flush=True)
    results.sort(key=lambda r: r["product_id"])
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False)
    erros = sum(1 for r in results if r.get("erro"))
    com_foto = sum(1 for r in results if r.get("imagens"))
    print(f"[{category}] concluído: {len(results)} produtos, {com_foto} com foto, {erros} com erro\n", flush=True)
    return results


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    categorias = sys.argv[1:] or CATEGORIES
    todos = []
    for category in categorias:
        for r in scrape_category(category):
            todos.append({**r, "linha": category})
    if not sys.argv[1:]:
        with open("data/imdepa.json", "w", encoding="utf-8") as f:
            json.dump(todos, f, ensure_ascii=False)
        erros = sum(1 for r in todos if r.get("erro"))
        com_foto = sum(1 for r in todos if r.get("imagens"))
        print(f"TOTAL: {len(todos)} produtos ({com_foto} com foto, {erros} com erro) -> data/imdepa.json")


if __name__ == "__main__":
    main()
