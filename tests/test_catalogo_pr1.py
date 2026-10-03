"""Regression gate for PR #1. Runs only against disposable databases it creates.

CATALOGO_TEST_ADMIN_DSN must identify a local Postgres 16 service, never production.
python -m unittest discover -s tests -v
"""
import contextlib
import copy
import csv
import importlib.util
import io
import json
import os
import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import uuid

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / (name + ".py"))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


loader = module("load_imdepa")
unifier = module("unificar_catalogo")


class Numbers(unittest.TestCase):
    def test_inverted_source_dimensions_are_retained_for_review(self):
        r = unifier.validar_dimensoes({"interno_mm": 50, "externo_mm": .7,
                                      "spec": {"codigo_fonte": "TCS0070"}})
        self.assertIsNone(r["interno_mm"])
        self.assertIsNone(r["externo_mm"])
        self.assertEqual(r["spec"]["_revisao_dimensoes"]["externo_mm"], .7)
        self.assertEqual(r["spec"]["codigo_fonte"], "TCS0070")

    def test_supported_units(self):
        cases = [(loader.to_mm, '1.1/4"', 31.75),
                 (loader.to_mm, '5/8"', 15.875),
                 (loader.to_mm, "3,5 cm", 35),
                 (loader.to_mm, "0,035 m", 35),
                 (loader.to_kg, "245 g", .245),
                 (loader.to_newton, "25,5 kN", 25500),
                 (loader.to_newton, "18.200 N", 18200),
                 (loader.to_rpm, "3.400 rpm com tolerância h6", 3400)]
        for fn, text, expected in cases:
            with self.subTest(text=text):
                self.assertEqual(fn(text), expected)

    def test_unknown_dimension_unit_is_rejected(self):
        self.assertIsNone(loader.to_mm("12 kg"))

    def test_unknown_mass_unit_is_rejected(self):
        self.assertIsNone(loader.to_kg("2 lb"))

    def test_unknown_force_unit_is_rejected(self):
        self.assertIsNone(loader.to_newton("2 kgf"))

    def test_zero_denominator_is_rejected_without_crash(self):
        self.assertIsNone(loader.to_mm('1/0"'))

    def test_two_parsers_agree_on_ptbr_thousands(self):
        self.assertEqual(unifier.num("18.200"), loader._num("18.200"))

    def test_identifiers_are_not_numbers(self):
        self.assertEqual(loader.num_generico("7891234567890", "GTIN"), (None, None))

    def test_raspador_is_not_gaxeta(self):
        self.assertNotEqual(unifier.tipo_de("Raspador hidráulico"),
                            unifier.tipo_de("Gaxeta hidráulica"))

    def test_serial_ranges_are_preserved(self):
        text = "content: 'JOHN DEERE 9750 (1 ATÉ 100)-||-JOHN DEERE 9750 (200 ATÉ 300)' }"
        self.assertEqual(len(loader.parse_maquinas(text)), 2)


class Database(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        admin = os.environ.get("CATALOGO_TEST_ADMIN_DSN")
        if not admin:
            raise RuntimeError("Set CATALOGO_TEST_ADMIN_DSN to an isolated Postgres 16 service")
        config = conninfo_to_dict(admin)
        if config.get("host") not in ("127.0.0.1", "localhost"):
            raise RuntimeError("Only a local disposable database service is accepted")
        cls.admin = psycopg.connect(admin, autocommit=True)
        version = cls.admin.execute("SHOW server_version_num").fetchone()[0]
        if not 160000 <= int(version) < 170000:
            raise RuntimeError("Postgres 16 required, got " + version)
        cls.name = "pr1_test_" + uuid.uuid4().hex[:12]
        cls.admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(cls.name)))
        config["dbname"] = cls.name
        cls.dsn = make_conninfo(**config)
        cls.db = psycopg.connect(cls.dsn, autocommit=True)
        cls.files = [ROOT / "sql/schema.sql", *sorted((ROOT / "sql/migrations").glob("*.sql"))]
        for file in cls.files:
            cls.db.execute(file.read_text())

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        cls.admin.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(cls.name)))
        cls.admin.close()

    def setUp(self):
        self.db.execute("SET search_path TO imdepa, catalogo, public")
        self.db.execute("TRUNCATE imdepa.product, imdepa.brand, imdepa.category,"
                        " imdepa.machine, imdepa.item RESTART IDENTITY CASCADE")

    def product(self, key="p1"):
        return {"product_id": key, "slug": key, "url": "https://example.test/" + key,
                "codigo": key, "nome": "Rolamento 35 mm x 62 mm x 14 mm",
                "marca": "TEST", "categoria1": "Rolamentos", "categoria2": "Radiais",
                "categoria3": "Esfera", "imagens": ["https://example.test/a.jpg"],
                "info_tecnica": {"Diâmetro Interno": "35 mm", "Diâmetro Externo": "62 mm",
                                 "Peso Bruto": "245 g"}}

    def load(self, records):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "rolamentos.json").write_text(json.dumps(records))
            with patch.object(loader, "DATA_DIR", directory), contextlib.redirect_stdout(io.StringIO()):
                loader.carregar(self.dsn, False)

    def item(self, origin, code, kind="retentor", supplier="imdepa",
             di=30, de=47, height=7, section=None, material="NBR"):
        return self.db.execute(
            "INSERT INTO imdepa.item (fornecedor_id,tipo_id,origem,origem_id,codigo,codigo_norm,"
            "nome,interno_mm,externo_mm,altura_mm,secao_mm,material) "
            "VALUES ((SELECT id FROM imdepa.fornecedor WHERE slug=%s),"
            "(SELECT id FROM imdepa.tipo_peca WHERE slug=%s),%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (supplier, kind, origin, code, code, code, code, di, de, height, section, material)
        ).fetchone()[0]

    def equivalents(self, identity, tolerance=0.5):
        return self.db.execute("SELECT * FROM imdepa.equivalentes(%s::integer,%s::numeric)",
                               (identity, tolerance)).fetchall()

    def test_migrations_can_be_reapplied(self):
        for file in self.files:
            self.db.execute(file.read_text())

    def test_extensions_and_indexes_exist(self):
        extensions = {x[0] for x in self.db.execute("SELECT extname FROM pg_extension")}
        self.assertTrue({"unaccent", "pg_trgm", "btree_gin"} <= extensions)
        self.assertIsNotNone(self.db.execute(
            "SELECT to_regclass('imdepa.uq_category_root')").fetchone()[0])
        self.assertIsNotNone(self.db.execute(
            "SELECT to_regclass('imdepa.idx_item_medidas')").fetchone()[0])

    def test_extensions_preinstalled_in_public(self):
        name = "pr1_public_" + uuid.uuid4().hex[:12]
        config = conninfo_to_dict(self.dsn)
        config["dbname"] = name
        self.admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        try:
            with psycopg.connect(make_conninfo(**config), autocommit=True) as conn:
                conn.execute("CREATE EXTENSION unaccent WITH SCHEMA public")
                conn.execute("CREATE EXTENSION pg_trgm WITH SCHEMA public")
                for file in self.files:
                    conn.execute(file.read_text())
                self.assertEqual(conn.execute("SELECT imdepa.f_unaccent('Rótula')").fetchone()[0], "Rotula")
        finally:
            self.admin.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))

    def test_imdepa_migrations_standalone(self):
        name = "pr1_standalone_" + uuid.uuid4().hex[:12]
        config = conninfo_to_dict(self.dsn)
        config["dbname"] = name
        self.admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        try:
            with psycopg.connect(make_conninfo(**config), autocommit=True) as conn:
                for file in self.files[1:]:
                    conn.execute(file.read_text())
                self.assertEqual(conn.execute("SELECT imdepa.f_unaccent('Rótula')").fetchone()[0], "Rotula")
        finally:
            self.admin.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))

    def test_example_queries_execute(self):
        for file in ("queries_imdepa.sql", "queries_unificado.sql"):
            self.db.execute((ROOT / "sql" / file).read_text())

    def test_reload_same_input_preserves_logical_counts(self):
        r = self.product()
        self.load([r])
        ids = self.db.execute("SELECT id FROM imdepa.product").fetchall()
        counts = [self.db.execute("SELECT count(*) FROM imdepa." + table).fetchone()[0]
                  for table in ("product", "product_image", "product_spec", "category")]
        self.load([r])
        self.assertEqual(ids, self.db.execute("SELECT id FROM imdepa.product").fetchall())
        self.assertEqual(counts, [self.db.execute("SELECT count(*) FROM imdepa." + table).fetchone()[0]
                                for table in ("product", "product_image", "product_spec", "category")])

    def test_changed_children_replace_old_data(self):
        r = self.product()
        r["imagens"].append("https://example.test/b.jpg")
        self.load([r])
        r["imagens"] = ["https://example.test/new.jpg"]
        r["info_tecnica"] = {}
        self.load([r])
        self.assertEqual(self.db.execute("SELECT url FROM imdepa.product_image").fetchall(),
                         [("https://example.test/new.jpg",)])
        self.assertEqual(self.db.execute("SELECT count(*) FROM imdepa.product_spec").fetchone()[0], 0)

    def test_changed_identity_metadata_updates(self):
        r = self.product()
        r["erro"] = "timeout"
        self.load([r])
        r.update(slug="new-slug", url="https://example.test/new", erro=None)
        self.load([r])
        self.assertEqual(self.db.execute("SELECT slug,url,scraped_erro FROM imdepa.product").fetchone(),
                         ("new-slug", "https://example.test/new", None))

    def test_duplicate_product_in_batch_keeps_final_children(self):
        first = self.product()
        last = copy.deepcopy(first)
        last["imagens"] = ["https://example.test/new.jpg"]
        last["info_tecnica"]["Peso Bruto"] = "500 g"
        self.load([first, last])
        self.assertEqual(self.db.execute("SELECT url FROM imdepa.product_image").fetchall(),
                         [("https://example.test/new.jpg",)])

    def test_title_provenance_clears_when_specs_become_complete(self):
        r = self.product()
        self.load([r])
        self.assertTrue(self.db.execute("SELECT medidas_do_titulo FROM imdepa.product").fetchone()[0])
        r["info_tecnica"]["Largura"] = "14 mm"
        self.load([r])
        self.assertFalse(self.db.execute("SELECT medidas_do_titulo FROM imdepa.product").fetchone()[0])

    def test_unified_imdepa_keeps_converted_inches(self):
        r = self.product()
        r["info_tecnica"]["Diâmetro Interno"] = '1.1/4"'
        self.load([r])
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory, "imdepa.json")
            p.write_text(json.dumps([r]))
            row = next(unifier.ler_imdepa(str(p)))
        self.assertEqual(row["interno_mm"], 31.75)

    def test_unified_imdepa_keeps_title_dimensions(self):
        r = self.product()
        self.load([r])
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory, "imdepa.json")
            p.write_text(json.dumps([r]))
            row = next(unifier.ler_imdepa(str(p)))
        self.assertEqual(row["altura_mm"], 14)

    def test_exact_equivalent_and_other_supplier_only(self):
        target = self.item("imdepa", "target")
        good = self.item("retentores", "good", supplier="rio-preto-vedacoes")
        self.item("imdepa", "same-supplier")
        self.item("orings", "different-type", kind="o-ring", supplier="agel")
        rows = self.equivalents(target)
        self.assertEqual([r[0] for r in rows], [good])
        self.assertEqual(rows[0][-1], 0)

    def test_oring_section_must_match(self):
        target = self.item("imdepa", "target", kind="o-ring", di=30, de=None,
                           height=None, section=2)
        self.item("orings", "wrong-section", kind="o-ring", supplier="agel",
                  di=30, de=None, height=None, section=5)
        self.assertEqual(self.equivalents(target), [])

    def test_incomplete_target_has_no_equivalents(self):
        target = self.item("imdepa", "target", de=None, height=None)
        self.item("retentores", "different-piece", supplier="rio-preto-vedacoes",
                  de=80, height=20)
        self.assertEqual(self.equivalents(target), [])

    def test_outro_does_not_establish_equivalence(self):
        target = self.item("imdepa", "unknown-a", kind="outro")
        self.item("retentores", "unknown-b", kind="outro", supplier="rio-preto-vedacoes")
        self.assertEqual(self.equivalents(target), [])

    def test_negative_tolerance_is_rejected(self):
        target = self.item("imdepa", "target")
        with self.assertRaises(psycopg.errors.InvalidParameterValue):
            self.equivalents(target, -1)

    def test_function_works_with_default_search_path(self):
        target = self.item("imdepa", "target")
        self.item("retentores", "good", supplier="rio-preto-vedacoes")
        self.db.execute("RESET search_path")
        self.assertEqual(len(self.equivalents(target)), 1)

    def test_refresh_works_with_default_search_path(self):
        self.db.execute("RESET search_path")
        self.db.execute("SELECT imdepa.refresh_catalogo()")

    def test_negative_dimension_constraint(self):
        with self.assertRaises(psycopg.errors.CheckViolation):
            self.item("imdepa", "negative", di=-30)

    def test_reversed_diameters_constraint(self):
        with self.assertRaises(psycopg.errors.CheckViolation):
            self.item("imdepa", "reversed", di=47, de=30)

    def test_unified_upsert_updates_supplier(self):
        def row(supplier):
            return (supplier, 1, "fixture", "one", "one", "ONE", "one", None, None,
                    30, 47, 7, None, "NBR", None, None, Jsonb({}))
        suppliers = [r[0] for r in self.db.execute("SELECT id FROM imdepa.fornecedor ORDER BY id LIMIT 2")]
        cur = self.db.cursor()
        unifier.gravar(cur, [row(suppliers[0])])
        unifier.gravar(cur, [row(suppliers[1])])
        self.assertEqual(self.db.execute("SELECT fornecedor_id FROM imdepa.item").fetchone()[0],
                         suppliers[1])

    def test_distinct_source_variants_are_not_overwritten(self):
        records = [
            {"fornecedor": "rio-preto-vedacoes", "tipo": "retentor",
             "origem": "retentores", "origem_id": "TCS0787", "codigo": "TCS0787",
             "nome": "Retentor", "marca": brand, "linha": None, "interno_mm": di,
             "externo_mm": 21, "altura_mm": 5, "secao_mm": None,
             "material": "NBR", "descricao": None, "imagem_url": None, "spec": {}}
            for brand, di in [("Rio Preto Vedações", 10), ("Agel", 12)]
        ]
        with patch.object(unifier, "FONTES", [lambda: iter(records)]), contextlib.redirect_stdout(io.StringIO()):
            unifier.unificar(self.dsn, False)
        self.assertEqual(self.db.execute("SELECT count(*) FROM imdepa.item").fetchone()[0], 2)

    def test_missing_sources_do_not_empty_existing_catalog(self):
        self.item("imdepa", "existing")
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            old = os.getcwd()
            try:
                os.chdir(directory)
                with self.assertRaises((RuntimeError, ValueError, SystemExit, FileNotFoundError)):
                    unifier.unificar(self.dsn, True)
            finally:
                os.chdir(old)
        self.assertEqual(self.db.execute("SELECT count(*) FROM imdepa.item").fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
