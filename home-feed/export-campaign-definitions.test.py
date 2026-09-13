from contextlib import closing
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('campaign_export',Path(__file__).with_name('export-campaign-definitions.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExportCampaignDefinitionsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='campaign-export-test-')
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'source.sqlite'
        with closing(sqlite3.connect(self.path)) as c:
            c.executescript('''CREATE TABLE mission_categories(id INTEGER PRIMARY KEY,name TEXT);
                CREATE TABLE missions(id INTEGER PRIMARY KEY,mission_category_id INTEGER,type TEXT,name TEXT,description TEXT,priority INTEGER,current_value TEXT,start_at TEXT);
                CREATE TABLE mission_rewards(id INTEGER PRIMARY KEY,mission_id INTEGER,item_id INTEGER,item_type TEXT,quantity INTEGER,accepted_reward_at TEXT);
                INSERT INTO mission_categories VALUES(3,'Board category'),(4,'Campaign completion');
                INSERT INTO missions VALUES(5,3,'Mission','Clear stage','Recorded description',0,'PRIVATE','PRIVATE DATE'),(6,4,'Mission','Complete campaign',NULL,0,'PRIVATE',NULL);
                INSERT INTO mission_rewards VALUES(8,5,1,'Point::Stone',3,'PRIVATE'),(9,6,2,'Card',1,'PRIVATE');''')
            c.commit()
        self.selection = dict(categoryIds=[3],completionMissionIds=[6])

    def digest(self):
        return hashlib.sha256(self.path.read_bytes()).hexdigest()

    def export(self, selection=None):
        return module.export_definitions(self.path,self.digest(),selection if selection is not None else self.selection)

    def test_exact_selected_definitions_and_no_account_or_dates(self):
        before = self.path.read_bytes()
        raw = self.export()
        data = json.loads(raw)
        self.assertEqual([m['id'] for m in data['missions']],[5,6])
        self.assertEqual([c['id'] for c in data['categories']],[3,4])
        self.assertEqual(data['databaseSha256'],self.digest())
        self.assertEqual(data['missions'][0]['rewards'][0]['quantity'],3)
        self.assertNotIn(b'PRIVATE',raw)
        self.assertNotIn(b'current_value',raw)
        self.assertNotIn(b'start_at',raw)
        self.assertEqual(self.path.read_bytes(),before)

    def test_missing_or_wrong_pin_rejected(self):
        for pin in [None,'','a'*64]:
            with self.assertRaises(ValueError):
                module.export_definitions(self.path,pin,self.selection)

    def test_unresolved_selection_rejected(self):
        for selection in [dict(categoryIds=[99],completionMissionIds=[]),dict(categoryIds=[],completionMissionIds=[99])]:
            with self.assertRaises(ValueError): self.export(selection)

    def test_duplicate_invalid_and_oversized_selectors(self):
        for selection in [None,{},dict(categoryIds=[3,3],completionMissionIds=[]),
                          dict(categoryIds=[True],completionMissionIds=[]),
                          dict(categoryIds=['3'],completionMissionIds=[]),
                          dict(categoryIds=list(range(1,1002)),completionMissionIds=[]),
                          dict(categoryIds=[],completionMissionIds=[],account='PRIVATE')]:
            with self.subTest(selection_type=type(selection).__name__), self.assertRaises(ValueError):
                module.export_definitions(self.path,self.digest(),selection)

    def test_read_order_and_overlap_are_deterministic(self):
        first=self.export(dict(categoryIds=[4,3],completionMissionIds=[5,6]))
        second=self.export(dict(categoryIds=[3,4],completionMissionIds=[6,5]))
        self.assertEqual(first,second)
        self.assertEqual(len(json.loads(first)['missions']),2)

    def test_multiline_copy_preserved_without_unsafe_direction_controls(self):
        self.assertEqual(module.text('Line one\r\nLine two',4096,True,True),'Line one\nLine two')
        self.assertEqual(module.text('Line one\nLine two',256),'Line one Line two')
        for value in ['bad\u061cname','bad\u200ename','bad\u200fname','bad\u2067name']:
            with self.assertRaises(ValueError): module.text(value,256)

    def test_live_sqlite_sidecars_rejected(self):
        for suffix in ['-wal','-journal']:
            sidecar=Path(str(self.path)+suffix)
            sidecar.write_bytes(b'')
            try:
                with self.assertRaises(ValueError): self.export()
            finally: sidecar.unlink()

    def test_invalid_reward_and_text(self):
        cases=[('UPDATE mission_rewards SET quantity=0 WHERE id=8',()),
               ('UPDATE mission_rewards SET item_type=? WHERE id=8',('PRIVATE/path',)),
               ('UPDATE missions SET name=? WHERE id=5',('bad\u202ename',))]
        for sql,params in cases:
            original=self.path.read_bytes()
            with closing(sqlite3.connect(self.path)) as c:
                c.execute(sql,params); c.commit()
            try:
                with self.assertRaises(ValueError): self.export()
            finally: self.path.write_bytes(original)

    def test_database_identity_revalidated(self):
        original=module.digest
        calls=[]
        def digest(path):
            calls.append(path)
            return original(path) if len(calls)==1 else 'a'*64
        module.digest=digest
        try:
            with self.assertRaises(ValueError): self.export()
        finally: module.digest=original
        self.assertEqual(len(calls),2)

    def test_output_limit_and_missing_db(self):
        original=module.MAX_BYTES; module.MAX_BYTES=10
        try:
            with self.assertRaises(ValueError): self.export()
        finally: module.MAX_BYTES=original
        missing=self.path.with_name('missing.sqlite')
        with self.assertRaises(FileNotFoundError): module.export_definitions(missing,self.digest(),self.selection)
        self.assertFalse(missing.exists())

    def test_cli_redacts_invalid_input(self):
        result=subprocess.run([sys.executable,'-B',str(Path(__file__).with_name('export-campaign-definitions.py')),
            '--database',str(self.path),'--database-sha256',self.digest()],input=b'PRIVATE',capture_output=True,timeout=15)
        self.assertEqual(result.returncode,1)
        self.assertEqual(result.stdout,b'')
        self.assertEqual(result.stderr.decode().strip(),'campaign_definition_export_failed')


if __name__ == '__main__': unittest.main()
