import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('builder','tools/build_catalog.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class Pipeline(unittest.TestCase):
 def run_case(self,mutate):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);module=json.loads(Path('survival_cache_starter_25.json').read_text());mutate(module)
   p=root/'input.json';p.write_text(json.dumps(module));old=(b.ROOT,b.OUT,b.MODULES);b.ROOT=root;b.OUT=root;b.MODULES=[p]
   try:return b.build()
   finally:b.ROOT,b.OUT,b.MODULES=old
 def test_valid_drafts(self):self.assertEqual(self.run_case(lambda m:None),0)
 def test_duplicate_ids(self):self.assertEqual(self.run_case(lambda m:m['articles'].append(m['articles'][0])),1)
 def test_unverified_approval(self):self.assertEqual(self.run_case(lambda m:m['articles'][0].update(status='approved')),1)
 def test_unknown_fields(self):self.assertEqual(self.run_case(lambda m:m['articles'][0].update(typo=True)),1)
 def test_duplicate_body(self):self.assertEqual(self.run_case(lambda m:m['articles'][1].update(body=m['articles'][0]['body'])),1)
 def test_missing_required_field(self):self.assertEqual(self.run_case(lambda m:m['articles'][0].pop('status')),1)
 def test_duplicate_module_id(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);raw=Path('survival_cache_starter_25.json').read_text()
   one=root/'one.json';two=root/'two.json';one.write_text(raw);two.write_text(raw)
   old=(b.ROOT,b.OUT,b.MODULES);b.ROOT=root;b.OUT=root;b.MODULES=[one,two]
   try:self.assertEqual(b.build(),1)
   finally:b.ROOT,b.OUT,b.MODULES=old
 def test_future_review(self):
  def mutate(m):
   m['articles'][0].update(status='approved',content_stage='complete',reviewed_by='Test fixture',reviewed_on='2999-01-01')
  self.assertEqual(self.run_case(mutate),1)
 def test_publication_archive(self):
  from zipfile import ZipFile
  from hashlib import sha256
  with ZipFile('dist/offline-survival-cache.zip') as archive:
   catalog=json.loads(archive.read('knowledge/catalog.json'))
   self.assertEqual(catalog['counts'],json.loads(Path('knowledge/catalog.json').read_text())['counts'])
   for name,digest in catalog['modules'].items():self.assertEqual(sha256(archive.read(name)).hexdigest(),digest)
   self.assertIn('START_HERE.txt',archive.namelist())
   self.assertNotIn('article_studio.html',archive.namelist())
