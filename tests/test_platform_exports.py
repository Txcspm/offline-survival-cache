import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('platform_export', 'tools/platform-evaluation/export.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class PlatformExports(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.articles, cls.divisions = exporter.read_library()

    def test_all_existing_records_and_originals_are_preserved(self):
        catalog = json.loads(Path('knowledge/catalog.json').read_text())
        ids = {a['id'] for a in self.articles}
        self.assertEqual(len(ids), catalog['total'] + 3)
        self.assertTrue({'OSC-0001', 'OSC-0002', 'OSC-0003'}.issubset(ids))
        self.assertTrue({a['id'] for a in catalog['articles']}.issubset(ids))

    def test_native_wiki_records_round_trip_without_losing_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            old = exporter.OUTPUT
            exporter.OUTPUT = Path(directory)
            try:
                exporter.export_tiddlywiki(self.articles, self.divisions)
                records = json.loads((Path(directory)/'tiddlywiki/tiddlers/library.json').read_text())
                articles = {r['osc-id']: r for r in records if 'osc-id' in r}
                self.assertEqual(len(articles), len(self.articles))
                for article in self.articles:
                    self.assertEqual(json.loads(articles[article['id']]['osc-record']), article)
            finally:
                exporter.OUTPUT = old

    def test_duplicate_titles_keep_separate_identifiers_and_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            old = exporter.OUTPUT
            exporter.OUTPUT = Path(directory)
            try:
                exporter.export_starlight(self.articles, self.divisions)
                root = Path(directory)/'starlight/src/content/docs'
                for ident in ['osc-0011', 'osc-0035', 'osc-0034', 'osc-0045']:
                    self.assertEqual(len(list(root.rglob(ident+'.md'))), 1)
            finally:
                exporter.OUTPUT = old

    def test_source_prose_cannot_become_raw_html(self):
        article = {**self.articles[0], 'body': ['<script>globalThis.injected = true</script>']}
        text = exporter.manuscript(article)
        self.assertNotIn('<script>', text)
        self.assertIn(r'\<script\>', text)
