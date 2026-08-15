#!/usr/bin/env python3
"""Scraper do catalogo da Imdepa (loja.imdepa.com.br).

Fonte da lista de produtos: sitemap.xml por categoria (ja baixados em
imdepa_sitemaps/). Para cada URL de produto, busca a pagina e extrai
og:title / og:image (server-side rendered, mesmo a pagina sendo SPA).
A descricao completa (com dimensoes) vem do proprio slug da URL.

Concorrente (ThreadPoolExecutor) pois sao ~12.500 paginas -- sequencial
seria inviavel. Salva incrementalmente por categoria (resume automatico).
"""
import csv
import gzip
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

import requests

SITEMAP_DIR = "data/scrapers/imdepa_sitemaps"
PROGRESS_DIR = "data/imdepa_partial"
CATEGORIES = [
    "rolamentos",
    "retentores",
    "vedacoes",
    "mancais",
    "correias",
    "aneis",
    "arruelas",
    "buchas",
    "correntes",
    "embreagens",
    "engrenagem",
    "esteiras",
    "ferramentas",
    "lubrificante",
    "mangueiras-e-terminais",
    "pecas-automotivas",
    "porcas",
    "rotulas",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
}
WORKERS = 12
MAX_RETRIES = 3

OG_TITLE_RE = re.compile(r'<meta property="og:title" content="([^"]*)"')
OG_IMAGE_RE = re.compile(r'<meta property="og:image" content="([^"]*)"')


def urls_from_sitemap(category: str):
    path = os.path.join(SITEMAP_DIR, f"imdepa_{category}.xml.gz")
    with gzip.open(path, "rt", encoding="utf-8") as f:
        content = f.read()
    urls = re.findall(r"<loc>([^<]+)</loc>", content)
    items = []
    for url in urls:
        parsed = urlparse(url)
        parts = parsed.path.strip("/").split("/")
        if len(parts) < 3 or parts[0] != "p":
            continue
        product_id, slug = parts[1], parts[2]
        items.append({"url": url, "product_id": product_id, "slug": slug})
    return items


def fetch_one(session: requests.Session, item: dict):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(item["url"], headers=HEADERS, timeout=15)
            if resp.status_code != 200:
                return {**item, "og_title": "", "og_image": "", "erro": f"HTTP {resp.status_code}"}
            html = resp.text
            m_title = OG_TITLE_RE.search(html)
            m_image = OG_IMAGE_RE.search(html)
            return {
                **item,
                "og_title": m_title.group(1) if m_title else "",
                "og_image": m_image.group(1) if m_image else "",
                "erro": "",
            }
        except requests.RequestException as e:
            if attempt == MAX_RETRIES:
                return {**item, "og_title": "", "og_image": "", "erro": str(e)}
            time.sleep(min(2 ** attempt, 10))


def scrape_category(category: str):
    out_path = os.path.join(PROGRESS_DIR, f"{category}.json")
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as f:
            data = json.load(f)
        print(f"[{category}] ja coletado (cache): {len(data)} produtos")
        return data

    items = urls_from_sitemap(category)
    print(f"[{category}] {len(items)} URLs no sitemap, buscando paginas...")

    results = []
    done = 0
    with requests.Session() as session, ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(fetch_one, session, item): item for item in items}
        for future in as_completed(futures):
            results.append(future.result())
            done += 1
            if done % 500 == 0:
                print(f"[{category}] {done}/{len(items)}")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False)

    erros = sum(1 for r in results if r["erro"])
    print(f"[{category}] concluido: {len(results)} produtos ({erros} com erro)\n")
    return results


def main():
    os.makedirs(PROGRESS_DIR, exist_ok=True)
    all_rows = []
    for category in CATEGORIES:
        items = scrape_category(category)
        for it in items:
            og_title = it.get("og_title", "")
            marca, _, codigo = og_title.partition(" - ")
            all_rows.append(
                {
                    "marca": marca.strip() or "Imdepa",
                    "linha": category,
                    "codigo": codigo.strip() or it["slug"],
                    "titulo": og_title or it["slug"].replace("-", " "),
                    "slug": it["slug"],
                    "imagem_url": it.get("og_image", ""),
                    "product_id": it["product_id"],
                    "url": it["url"],
                    "erro": it.get("erro", ""),
                }
            )

    fieldnames = [
        "marca",
        "linha",
        "codigo",
        "titulo",
        "slug",
        "imagem_url",
        "product_id",
        "url",
        "erro",
    ]
    with open("data/imdepa.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"TOTAL: {len(all_rows)} produtos -> data/imdepa.csv")


if __name__ == "__main__":
    main()
