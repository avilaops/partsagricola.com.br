#!/usr/bin/env python3
"""Normaliza, classifica e audita os catálogos antes da importação no Medusa."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_DIR = DATA_DIR / "processed"
IMPORT_PATH = OUTPUT_DIR / "catalog_import.csv"
QUARANTINE_PATH = OUTPUT_DIR / "catalog_quarantine.csv"
AUDIT_PATH = OUTPUT_DIR / "catalog_audit.json"
REPORT_PATH = OUTPUT_DIR / "DATA_QUALITY_REPORT.md"
SCOPE_PATH = DATA_DIR / "catalog_scope.json"

CANONICAL_FIELDS = [
    "import_key",
    "source",
    "source_row",
    "source_brand",
    "source_code",
    "source_sku",
    "title",
    "description",
    "category",
    "image_url",
    "weight_grams",
    "metadata_json",
]

QUARANTINE_FIELDS = [
    "source",
    "source_row",
    "source_code",
    "reason",
    "raw_json",
]

SPACE_RE = re.compile(r"\s+")
SUPPLIER_SENTENCE_RE = re.compile(
    r"[^.!?]*(?:GEOMAQ|lojas?|vendedores?|departamento de vendas)[^.!?]*[.!?]?",
    re.IGNORECASE,
)


@dataclass
class ProcessingResult:
    imports: list[dict[str, str]] = field(default_factory=list)
    quarantine: list[dict[str, str]] = field(default_factory=list)
    input_counts: Counter[str] = field(default_factory=Counter)
    imported_counts: Counter[str] = field(default_factory=Counter)
    quarantine_counts: Counter[str] = field(default_factory=Counter)
    reason_counts: Counter[str] = field(default_factory=Counter)


def clean_text(value: str | None) -> str:
    return SPACE_RE.sub(" ", unicodedata.normalize("NFC", value or "")).strip()


def clean_code(value: str | None) -> str:
    return clean_text(value).upper()


def slug_hash(*parts: str) -> str:
    value = "\x1f".join(clean_text(part).casefold() for part in parts)
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:20]


def decimal_value(value: str | None) -> Decimal | None:
    normalized = clean_text(value).replace(".", "").replace(",", ".")
    if not normalized:
        return None
    try:
        parsed = Decimal(normalized)
    except InvalidOperation:
        return None
    return parsed if parsed >= 0 else None


def decimal_string(value: str | None) -> str:
    parsed = decimal_value(value)
    if parsed is None:
        return ""
    return format(parsed.normalize(), "f")


def sanitize_description(value: str | None, title: str) -> str:
    description = clean_text(value)
    description = clean_text(SUPPLIER_SENTENCE_RE.sub(" ", description))
    if description.casefold() == clean_text(title).casefold():
        return ""
    return description


def clean_online_title(row: dict[str, str]) -> str:
    code = re.escape(clean_code(row.get("codigo")))
    title = clean_text(row.get("nome"))
    title = re.sub(rf"^{code}\s*[-–—:]\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*[-–—]\s*Linha\s+[^-–—]+\s*$", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\bGeomaq\b", "", title, flags=re.IGNORECASE)
    return clean_text(title).strip("-–— ")


def normalize_industrial_line(value: str | None) -> str:
    line = clean_text(value)
    known_lines = (
        "New Holland Industrial",
        "Massey Ferguson",
        "Yale Carregadeira",
        "Michigan Anéis",
        "Fiat Anéis",
        "Huber Warco",
        "Caterpillar",
        "Bob Cat",
        "Danfoss",
        "Dinapac",
        "Engesa",
        "Hyundai",
        "Komatsu",
        "Michigan",
        "Muller",
        "Randon",
        "Volvo",
        "Case",
        "Fiat",
        "JCB",
    )
    for known_line in known_lines:
        if line.casefold().startswith(known_line.casefold()):
            return known_line
    return line


def canonical_row(
    *,
    source: str,
    source_row: int,
    source_brand: str,
    source_code: str,
    source_sku: str,
    identity_parts: tuple[str, ...],
    title: str,
    description: str,
    category: str,
    image_url: str = "",
    weight_grams: str = "",
    metadata: dict[str, object] | None = None,
) -> dict[str, str]:
    import_key = f"{source}:{slug_hash(*identity_parts)}"
    full_metadata = {
        "import_key": import_key,
        "source": source,
        "source_brand": source_brand,
        "source_code": source_code,
        "source_row": source_row,
        **(metadata or {}),
    }
    return {
        "import_key": import_key,
        "source": source,
        "source_row": str(source_row),
        "source_brand": source_brand,
        "source_code": source_code,
        "source_sku": source_sku,
        "title": clean_text(title),
        "description": clean_text(description),
        "category": clean_text(category),
        "image_url": clean_text(image_url),
        "weight_grams": weight_grams,
        "metadata_json": json.dumps(
            full_metadata, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ),
    }


def quarantine_row(
    source: str, source_row: int, row: dict[str, str], reason: str
) -> dict[str, str]:
    return {
        "source": source,
        "source_row": str(source_row),
        "source_code": clean_code(row.get("codigo")),
        "reason": reason,
        "raw_json": json.dumps(
            row, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ),
    }


def from_geomaq(row: dict[str, str], source_row: int) -> tuple[dict[str, str] | None, str]:
    code = clean_code(row.get("codigo"))
    external_id = clean_text(row.get("geomaq_id"))
    source_sku = clean_text(row.get("sku_interno"))
    title = clean_online_title(row)
    if not code:
        return None, "codigo_ausente"
    if not external_id:
        return None, "id_origem_ausente"
    if not source_sku:
        return None, "sku_origem_ausente"
    if not title:
        return None, "titulo_ausente"

    line = clean_text(row.get("linha"))
    segment = (
        "Máquinas Pesadas"
        if line in {"Construção", "Rodante"}
        else "Peças Agrícolas"
    )
    weight = decimal_value(row.get("peso"))
    weight_grams = str(int(weight * 1000)) if weight and weight > 0 else ""
    description = sanitize_description(row.get("descricao"), clean_text(row.get("nome")))
    image_url = clean_text(row.get("imagem_url"))
    if "imagem-temporario-pecas" in image_url:
        image_url = ""
    return (
        canonical_row(
            source="geomaq_online",
            source_row=source_row,
            source_brand=clean_text(row.get("marca")),
            source_code=code,
            source_sku=source_sku,
            identity_parts=(external_id,),
            title=f"{title} — {code}",
            description=description,
            category=f"{segment} - {line}",
            image_url=image_url,
            weight_grams=weight_grams,
            metadata={
                "source_external_id": external_id,
                "source_line": line,
                "source_url_slug": clean_text(row.get("url_slug")),
            },
        ),
        "",
    )


def from_industrial(row: dict[str, str], source_row: int) -> tuple[dict[str, str] | None, str]:
    code = clean_code(row.get("codigo"))
    description = clean_text(row.get("descricao"))
    line = normalize_industrial_line(row.get("linha"))
    if not code:
        return None, "codigo_ausente"
    if not description:
        return None, "descricao_ausente"
    if clean_text(row.get("revisar")).casefold() == "sim":
        return None, "marcado_para_revisao"

    return (
        canonical_row(
            source="rpv_industrial",
            source_row=source_row,
            source_brand=clean_text(row.get("marca")),
            source_code=code,
            source_sku="",
            identity_parts=(line, code, description),
            title=f"{description} — {code}",
            description=f"Aplicação: {line}.",
            category=f"Vedações Industriais - {line}",
            metadata={"source_line": line},
        ),
        "",
    )


def from_kits(row: dict[str, str], source_row: int) -> tuple[dict[str, str] | None, str]:
    code = clean_code(row.get("codigo"))
    description = clean_text(row.get("descricao"))
    market_reference = clean_text(row.get("ref_mercado"))
    brand = clean_text(row.get("marca"))
    line = clean_text(row.get("linha"))
    if not code:
        return None, "codigo_ausente"
    if not description:
        return None, "descricao_ausente"
    if len(market_reference) > 1000 or "Cód. AGEL" in market_reference:
        return None, "referencia_mercado_contaminada"

    application = re.sub(
        r"^(?:Aplicação\s+)?(?:Rep\.\s*(?:BBA\.|CX\.)\s*)?",
        "",
        description,
        flags=re.IGNORECASE,
    )
    application = clean_text(application).strip("-–— ")
    application_summary = application[:72].rsplit(" ", 1)[0] if len(application) > 72 else application
    title = f"Kit de reparo {code}"
    if application_summary:
        title += f" — {application_summary}"

    return (
        canonical_row(
            source="kits_catalogo",
            source_row=source_row,
            source_brand=brand,
            source_code=code,
            source_sku="",
            identity_parts=(brand, line, code, market_reference, description),
            title=title,
            description=description,
            category="Kits de Reparo - Direção Hidráulica",
            metadata={
                "market_reference": market_reference,
                "source_line": line,
            },
        ),
        "",
    )


def from_retentores(row: dict[str, str], source_row: int) -> tuple[dict[str, str] | None, str]:
    code = clean_code(row.get("codigo"))
    brand = clean_text(row.get("marca"))
    shaft = decimal_string(row.get("eixo_mm"))
    external = decimal_string(row.get("externo_mm"))
    height = decimal_string(row.get("altura_mm"))
    model = clean_text(row.get("modelo"))
    material = clean_text(row.get("material"))
    if not code:
        return None, "codigo_ausente"
    if not shaft or not external:
        return None, "dimensoes_principais_ausentes"
    if clean_text(row.get("revisar")).casefold() == "sim" or not height:
        return None, "altura_nao_confirmada"

    dimensions = f"{shaft} × {external} × {height} mm"
    return (
        canonical_row(
            source="retentores",
            source_row=source_row,
            source_brand=brand,
            source_code=code,
            source_sku="",
            identity_parts=(brand, code, shaft, external, height, model, material),
            title=f"Retentor {code} — {dimensions}",
            description=f"Modelo {model}. Material {material}.",
            category="Retentores",
            metadata={
                "shaft_mm": shaft,
                "external_mm": external,
                "height_mm": height,
                "model": model,
                "material": material,
            },
        ),
        "",
    )


def from_orings(row: dict[str, str], source_row: int) -> tuple[dict[str, str] | None, str]:
    code = clean_code(row.get("codigo"))
    line = clean_text(row.get("linha"))
    diameter = decimal_string(row.get("diametro_interno_mm"))
    tolerance = decimal_string(row.get("tolerancia_mm"))
    section = decimal_string(row.get("secao_w_mm"))
    if not code:
        return None, "codigo_ausente"
    if not diameter:
        return None, "diametro_ausente_ou_invalido"
    if line == "O-Rings Standard" and not tolerance:
        return None, "tolerancia_ausente"
    if line == "O-Rings Milimétrico" and not section:
        return None, "secao_ausente"

    detail = f"Ø interno {diameter} mm"
    if section:
        detail += f" × seção {section} mm"
    return (
        canonical_row(
            source="orings",
            source_row=source_row,
            source_brand=clean_text(row.get("marca")),
            source_code=code,
            source_sku="",
            identity_parts=(line, code, diameter, tolerance, section),
            title=f"O-Ring {code} — {detail}",
            description=(
                f"Tolerância dimensional: ±{tolerance} mm."
                if tolerance
                else ""
            ),
            category=(
                "O-Rings - Milimétricos"
                if line == "O-Rings Milimétrico"
                else "O-Rings - Standard"
            ),
            metadata={
                "internal_diameter_mm": diameter,
                "tolerance_mm": tolerance,
                "section_mm": section,
                "source_line": line,
            },
        ),
        "",
    )


def from_gaxetas(row: dict[str, str], source_row: int) -> tuple[dict[str, str] | None, str]:
    code = clean_code(row.get("codigo"))
    brand = clean_text(row.get("marca"))
    line = clean_text(row.get("linha"))
    description = clean_text(row.get("descricao"))
    inner = decimal_string(row.get("interno_mm"))
    external = decimal_string(row.get("externo_mm"))
    height = decimal_string(row.get("altura_mm"))
    if not code:
        return None, "codigo_ausente"
    if not description:
        return None, "descricao_ausente"

    dimensions = " × ".join(value for value in (inner, external, height) if value)
    title = f"{description} — {code}"
    if dimensions:
        title += f" — {dimensions} mm"
    return (
        canonical_row(
            source="gaxetas_raspadores",
            source_row=source_row,
            source_brand=brand,
            source_code=code,
            source_sku="",
            identity_parts=(brand, line, code, description, inner, external, height),
            title=title,
            description="",
            category=line,
            metadata={
                "internal_mm": inner,
                "external_mm": external,
                "height_mm": height,
                "source_line": line,
            },
        ),
        "",
    )


SOURCES: list[
    tuple[str, str, Callable[[dict[str, str], int], tuple[dict[str, str] | None, str]]]
] = [
    ("geomaq_online", "geomaq_online.csv", from_geomaq),
    ("rpv_industrial", "riopretovedacoes_industrial.csv", from_industrial),
    ("kits_catalogo", "kits_catalogo.csv", from_kits),
    ("retentores", "retentores.csv", from_retentores),
    ("orings", "orings.csv", from_orings),
    ("gaxetas_raspadores", "gaxetas_raspadores.csv", from_gaxetas),
]


def read_rows(filename: str) -> list[dict[str, str]]:
    with (DATA_DIR / filename).open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def process() -> ProcessingResult:
    result = ProcessingResult()
    seen_import_keys: dict[str, tuple[str, int]] = {}
    for source, filename, adapter in SOURCES:
        for source_row, raw_row in enumerate(read_rows(filename), start=2):
            result.input_counts[source] += 1
            item, reason = adapter(raw_row, source_row)
            if item is None:
                result.quarantine.append(
                    quarantine_row(source, source_row, raw_row, reason)
                )
                result.quarantine_counts[source] += 1
                result.reason_counts[reason] += 1
                continue

            import_key = item["import_key"]
            if import_key in seen_import_keys:
                first_source, first_row = seen_import_keys[import_key]
                duplicate_reason = (
                    f"identidade_duplicada_com_{first_source}_linha_{first_row}"
                )
                result.quarantine.append(
                    quarantine_row(source, source_row, raw_row, duplicate_reason)
                )
                result.quarantine_counts[source] += 1
                result.reason_counts["identidade_duplicada"] += 1
                continue

            seen_import_keys[import_key] = (source, source_row)
            result.imports.append(item)
            result.imported_counts[source] += 1

    return result


def validate(result: ProcessingResult) -> dict[str, object]:
    total_input = sum(result.input_counts.values())
    total_import = len(result.imports)
    total_quarantine = len(result.quarantine)
    duplicate_import_keys = [
        key
        for key, count in Counter(row["import_key"] for row in result.imports).items()
        if count > 1
    ]
    duplicate_source_skus = [
        sku
        for sku, count in Counter(
            row["source_sku"] for row in result.imports if row["source_sku"]
        ).items()
        if count > 1
    ]
    blank_required = {
        field: sum(not row[field] for row in result.imports)
        for field in ("import_key", "source", "source_code", "title", "category")
    }
    unclassified = total_input - total_import - total_quarantine
    source_warnings = catalog_source_warnings()
    checks_passed = (
        unclassified == 0
        and not duplicate_import_keys
        and not duplicate_source_skus
        and not any(blank_required.values())
    )
    return {
        "total_input": total_input,
        "total_import": total_import,
        "total_quarantine": total_quarantine,
        "unclassified": unclassified,
        "input_by_source": dict(sorted(result.input_counts.items())),
        "import_by_source": dict(sorted(result.imported_counts.items())),
        "quarantine_by_source": dict(sorted(result.quarantine_counts.items())),
        "quarantine_reasons": dict(sorted(result.reason_counts.items())),
        "duplicate_import_keys": duplicate_import_keys,
        "duplicate_source_skus": duplicate_source_skus,
        "blank_required_fields": blank_required,
        "checks_passed": checks_passed,
        "deployment_ready": checks_passed and not source_warnings,
        "source_warnings": source_warnings,
        "catalog_scope": read_catalog_scope(),
    }


def read_catalog_scope() -> dict[str, object]:
    if not SCOPE_PATH.exists():
        return {}
    return json.loads(SCOPE_PATH.read_text(encoding="utf-8"))


def catalog_source_warnings() -> list[str]:
    csv_rows = read_rows("geomaq_online.csv")
    csv_counts = Counter(clean_text(row.get("categoria_id")) for row in csv_rows)
    warnings: list[str] = []
    scope = read_catalog_scope()
    if scope.get("mode") == "curated_snapshot":
        source_path = ROOT / str(scope.get("source_file", ""))
        if not source_path.exists():
            return ["catalog_scope: arquivo_fonte_ausente"]
        actual_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
        if actual_hash != scope.get("sha256"):
            warnings.append("catalog_scope: sha256_divergente")
        if len(csv_rows) != scope.get("expected_rows"):
            warnings.append(
                f"catalog_scope: linhas={len(csv_rows)}, "
                f"esperado={scope.get('expected_rows')}"
            )
        expected_counts = {
            str(key): int(value)
            for key, value in dict(scope.get("category_counts", {})).items()
        }
        if dict(sorted(csv_counts.items())) != dict(sorted(expected_counts.items())):
            warnings.append("catalog_scope: contagem_por_categoria_divergente")
        return warnings

    partial_dir = DATA_DIR / "geomaq_online_partial"

    for partial_path in sorted(partial_dir.glob("*.json")):
        if partial_path.name.endswith(".progress.json"):
            continue
        category_id = partial_path.stem
        partial_rows = json.loads(partial_path.read_text(encoding="utf-8"))
        partial_count = len(partial_rows)
        csv_count = csv_counts.get(category_id, 0)
        if partial_count != csv_count:
            warnings.append(
                f"geomaq_categoria_{category_id}: "
                f"csv={csv_count}, cache_final={partial_count}"
            )

    for progress_path in sorted(partial_dir.glob("*.progress.json")):
        category_id = progress_path.name.removesuffix(".progress.json")
        progress = json.loads(progress_path.read_text(encoding="utf-8"))
        progress_count = len(progress.get("items", []))
        csv_count = csv_counts.get(category_id, 0)
        if progress_count > csv_count:
            warnings.append(
                f"geomaq_categoria_{category_id}: "
                f"csv={csv_count}, coleta_incompleta={progress_count}+"
            )

    for category_id in ("271", "272"):
        final_path = partial_dir / f"{category_id}.json"
        if not final_path.exists():
            warnings.append(
                f"geomaq_categoria_{category_id}: cache_final_ausente"
            )

    return warnings


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def write_report(audit: dict[str, object]) -> None:
    lines = [
        "# Relatório de qualidade dos catálogos",
        "",
        "## Resultado",
        "",
        f"- Linhas de origem: **{audit['total_input']}**",
        f"- Aprovadas para importação: **{audit['total_import']}**",
        f"- Enviadas para quarentena: **{audit['total_quarantine']}**",
        f"- Linhas sem classificação: **{audit['unclassified']}**",
        f"- Validação automática: **{'APROVADA' if audit['checks_passed'] else 'REPROVADA'}**",
        f"- Pronto para deploy: **{'SIM' if audit['deployment_ready'] else 'NÃO'}**",
        "",
        "## Por fonte",
        "",
        "| Fonte | Origem | Importar | Quarentena |",
        "|---|---:|---:|---:|",
    ]
    input_by_source = audit["input_by_source"]
    import_by_source = audit["import_by_source"]
    quarantine_by_source = audit["quarantine_by_source"]
    for source in input_by_source:
        lines.append(
            f"| {source} | {input_by_source[source]} | "
            f"{import_by_source.get(source, 0)} | {quarantine_by_source.get(source, 0)} |"
        )

    lines.extend(["", "## Motivos de quarentena", ""])
    for reason, count in audit["quarantine_reasons"].items():
        lines.append(f"- `{reason}`: {count}")

    lines.extend(["", "## Alertas de origem", ""])
    source_warnings = audit["source_warnings"]
    if source_warnings:
        for warning in source_warnings:
            lines.append(f"- {warning}")
    else:
        lines.append("- Nenhum.")

    scope = audit["catalog_scope"]
    if scope:
        lines.extend(
            [
                "",
                "## Escopo fechado",
                "",
                f"- Modo: `{scope.get('mode')}`",
                f"- Arquivo: `{scope.get('source_file')}`",
                f"- Linhas esperadas: {scope.get('expected_rows')}",
                f"- Decisão: {scope.get('decision')}",
            ]
        )

    lines.extend(
        [
            "",
            "## Garantias",
            "",
            "- Cada linha de origem termina em importação ou quarentena.",
            "- `import_key` é determinístico e único, permitindo reexecução idempotente.",
            "- Códigos repetidos com aplicações distintas são preservados.",
            "- Nomes de fornecedores ficam apenas em metadados internos.",
            "- Categorias públicas usam uma taxonomia comercial neutra.",
            "- Registros incompletos não são publicados automaticamente.",
            "",
        ]
    )
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    result = process()
    result.imports.sort(key=lambda row: (row["source"], row["import_key"]))
    result.quarantine.sort(
        key=lambda row: (row["source"], int(row["source_row"]))
    )
    audit = validate(result)
    write_csv(IMPORT_PATH, result.imports, CANONICAL_FIELDS)
    write_csv(QUARANTINE_PATH, result.quarantine, QUARANTINE_FIELDS)
    AUDIT_PATH.write_text(
        json.dumps(audit, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    write_report(audit)
    print(json.dumps(audit, ensure_ascii=False, indent=2, sort_keys=True))
    if not audit["checks_passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
