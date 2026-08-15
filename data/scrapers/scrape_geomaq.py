#!/usr/bin/env python3
"""Scraper do catalogo online da Geomaq (plataforma Interago).

Usa o endpoint AJAX que o proprio site chama para paginacao infinita
(loadProductList.php), um por linha de produto, ate a resposta vir vazia.
Salva o dataset combinado em data/geomaq_online.csv e .json.
"""
import csv
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

AJAX_URL = "https://app.interago.com.br/App/Extensions/5/compile/assets/loadProductList.php"
HEADERS = {
    "Content-type": "application/x-www-form-urlencoded",
    "User-Agent": "Mozilla/5.0 (compatible; AgricolaCatalogBot/1.0; +https://partsagricola.com.br)",
}

LINES = {
    "2709": "Algodão",
    "2710": "Amendoim",
    "270": "Canavieira",
    "271": "Construção",
    "272": "Grãos",
    "2711": "Implementos Agrícolas",
    "273": "Rodante",
    "274": "Tratores",
}

LIST_QTD = 30
SLEEP_BETWEEN_PAGES = 0.2
MAX_PAGES_SAFETY = 5000
MAX_RETRIES = 5
PROGRESS_DIR = "data/geomaq_online_partial"
CHECKPOINT_EVERY = 25
FETCH_CONCURRENCY = 4


def fetch_page(category_id: str, scroll_deep: int):
    data = urllib.parse.urlencode(
        {
            "categoryId": category_id,
            "siteId": "138",
            "scrollDeep": str(scroll_deep),
            "filters": "906",
            "listQtd": str(LIST_QTD),
            "orderBy": "ProductImg DESC",
            "showChildren": "true",
            "req": "listProducts",
        }
    ).encode()
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(AJAX_URL, data=data, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=25) as resp:
                body = resp.read().decode("utf-8")
            body = body.strip()
            if body in ("0", '"0"', "", "null"):
                return []
            raw = json.loads(body)
            return [json.loads(x) if isinstance(x, str) else x for x in raw]
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as e:
            last_err = e
            wait = min(2 ** attempt, 30)
            print(f"    aviso: falha na pagina {scroll_deep} (tentativa {attempt}/{MAX_RETRIES}): {e} -- retry em {wait}s")
            time.sleep(wait)
    raise RuntimeError(f"Falhou apos {MAX_RETRIES} tentativas na pagina {scroll_deep}: {last_err}")


def scrape_line(category_id: str, line_name: str):
    checkpoint_path = os.path.join(PROGRESS_DIR, f"{category_id}.progress.json")
    seen = {}
    scroll = 1
    if os.path.exists(checkpoint_path):
        with open(checkpoint_path, "r", encoding="utf-8") as f:
            checkpoint = json.load(f)
        if checkpoint.get("list_qtd") == LIST_QTD:
            seen = {
                str(item["id"]): item
                for item in checkpoint.get("items", [])
                if item.get("id")
            }
            scroll = int(checkpoint.get("next_scroll", 1))
            print(
                f"  [{line_name}] retomando pagina {scroll}, "
                f"{len(seen)} itens preservados"
            )

    finished = False
    with ThreadPoolExecutor(max_workers=FETCH_CONCURRENCY) as executor:
        while scroll <= MAX_PAGES_SAFETY and not finished:
            page_numbers = list(
                range(
                    scroll,
                    min(scroll + FETCH_CONCURRENCY, MAX_PAGES_SAFETY + 1),
                )
            )
            page_items = executor.map(
                lambda page: fetch_page(category_id, page), page_numbers
            )
            for page_number, items in zip(page_numbers, page_items):
                if not items:
                    finished = True
                    break
                new_count = 0
                for it in items:
                    pid = it.get("id")
                    if pid and pid not in seen:
                        seen[pid] = it
                        new_count += 1
                print(
                    f"  [{line_name}] pagina {page_number}: {len(items)} itens "
                    f"({new_count} novos, total {len(seen)})"
                )
                if new_count == 0:
                    finished = True
                    break
                scroll = page_number + 1

            if scroll % CHECKPOINT_EVERY <= FETCH_CONCURRENCY:
                temporary_checkpoint = f"{checkpoint_path}.tmp"
                with open(temporary_checkpoint, "w", encoding="utf-8") as f:
                    json.dump(
                        {
                            "list_qtd": LIST_QTD,
                            "next_scroll": scroll,
                            "items": list(seen.values()),
                        },
                        f,
                        ensure_ascii=False,
                    )
                os.replace(temporary_checkpoint, checkpoint_path)
            time.sleep(SLEEP_BETWEEN_PAGES)

    if not finished and scroll > MAX_PAGES_SAFETY:
        raise RuntimeError(
            f"Limite de seguranca atingido em {line_name}; "
            "coleta nao foi marcada como completa."
        )
    if os.path.exists(checkpoint_path):
        os.remove(checkpoint_path)
    return list(seen.values())


def main():
    os.makedirs(PROGRESS_DIR, exist_ok=True)
    all_rows = []
    for category_id, line_name in LINES.items():
        partial_path = os.path.join(PROGRESS_DIR, f"{category_id}.json")
        if os.path.exists(partial_path):
            with open(partial_path, "r", encoding="utf-8") as f:
                items = json.load(f)
            print(f"Linha ja coletada (cache): {line_name} -> {len(items)} produtos")
        else:
            print(f"Coletando linha: {line_name} (categoryId={category_id})")
            items = scrape_line(category_id, line_name)
            temporary_partial = f"{partial_path}.tmp"
            with open(temporary_partial, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False)
            os.replace(temporary_partial, partial_path)
        for it in items:
            all_rows.append(
                {
                    "marca": "Geomaq",
                    "linha": line_name,
                    "codigo": (it.get("mpn") or "").strip(),
                    "sku_interno": (it.get("sku") or "").strip(),
                    "nome": (it.get("title") or "").strip(),
                    "descricao": (it.get("description") or "").strip(),
                    "preco": it.get("price") or "",
                    "peso": it.get("weight") or "",
                    "marca_compativel": (it.get("brandName") or "").strip(),
                    "url_slug": it.get("url") or "",
                    "imagem_url": (it.get("img") or "").replace("w_0_", "w_800_"),
                    "categoria_id": category_id,
                    "geomaq_id": it.get("id") or "",
                }
            )
        print(f"  -> {len(items)} produtos em {line_name}\n")

    # dedupe global por geomaq_id (algumas linhas podem sobrepor)
    dedup = {}
    for row in all_rows:
        dedup[row["geomaq_id"]] = row
    rows = list(dedup.values())

    print(f"Total geral (apos dedupe): {len(rows)} produtos")

    fieldnames = [
        "marca",
        "linha",
        "codigo",
        "sku_interno",
        "nome",
        "descricao",
        "preco",
        "peso",
        "marca_compativel",
        "url_slug",
        "imagem_url",
        "categoria_id",
        "geomaq_id",
    ]

    csv_path = "data/geomaq_online.csv"
    temporary_csv = f"{csv_path}.tmp"
    with open(temporary_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    os.replace(temporary_csv, csv_path)

    json_path = "data/geomaq_online.json"
    temporary_json = f"{json_path}.tmp"
    with open(temporary_json, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    os.replace(temporary_json, json_path)

    print("Salvo em data/geomaq_online.csv e data/geomaq_online.json")


if __name__ == "__main__":
    main()
