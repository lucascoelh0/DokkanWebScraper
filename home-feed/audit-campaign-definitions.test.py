import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('campaign_audit', Path(__file__).with_name('audit-campaign-definitions.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CampaignDefinitionAuditTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='campaign-definition-test-')
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'definitions.sqlite'
        with closing(sqlite3.connect(self.path)) as c:
            c.executescript('''CREATE TABLE mission_categories(id INTEGER PRIMARY KEY);
                CREATE TABLE missions(id INTEGER PRIMARY KEY, mission_category_id INTEGER);
                CREATE TABLE mission_rewards(id INTEGER PRIMARY KEY, mission_id INTEGER);
                INSERT INTO mission_categories VALUES (3),(4);
                INSERT INTO missions VALUES (5,3),(6,3),(7,4);
                INSERT INTO mission_rewards VALUES (8,5),(9,6),(10,7);''')
            c.commit()
        self.board = dict(id=1,mission_category_id=3,complete_mission_id=5,display_reward_id=8)

    def test_aligned_joins_read_only_no_private_output(self):
        original = self.path.read_bytes()
        row = dict(self.board, name='PRIVATE', current_value='PRIVATE', token='PRIVATE')
        result = module.audit_definitions(self.path,[row])
        self.assertEqual(result['alignedBoards'],1)
        self.assertEqual(result['categoryMissionCount'],2)
        self.assertEqual(result['categoryRewardCount'],2)
        self.assertFalse(result['publicationAllowed'])
        self.assertNotIn('PRIVATE',json.dumps(result))
        self.assertEqual(self.path.read_bytes(),original)

    def test_existing_but_unrelated_ids_do_not_prove_join(self):
        result = module.audit_definitions(self.path,[dict(self.board,complete_mission_id=7)])
        self.assertEqual(result['completionMatched'],1)
        self.assertEqual(result['displayRewardMatched'],1)
        self.assertEqual(result['alignedBoards'],0)
        self.assertEqual(result['completionCategoryMatched'],0)
        self.assertEqual(result['displayCompletionMatched'],0)

    def test_missing_references(self):
        result = module.audit_definitions(self.path,[dict(self.board,mission_category_id=99,display_reward_id=99)])
        self.assertEqual(result['categoryMatched'],0)
        self.assertEqual(result['displayRewardMatched'],0)
        self.assertEqual(result['alignedBoards'],0)

    def test_repeated_categories_not_double_counted(self):
        result = module.audit_definitions(self.path,[self.board,dict(self.board,id=2)])
        self.assertEqual(result['alignedBoards'],2)
        self.assertEqual(result['uniqueCategories'],1)
        self.assertEqual(result['categoryMissionCount'],2)

    def test_invalid_and_duplicate_boards(self):
        for rows in [None,{},[self.board]*1001,[self.board,self.board],[{}],
                     [dict(self.board,id=True)],[dict(self.board,id='1')],
                     [dict(self.board,id=1000000000)]]:
            with self.subTest(rows_type=type(rows).__name__), self.assertRaises(ValueError):
                module.audit_definitions(self.path,rows)

    def test_missing_database_not_created(self):
        missing = self.path.with_name('missing.sqlite')
        with self.assertRaises(FileNotFoundError):
            module.audit_definitions(missing,[])
        self.assertFalse(missing.exists())

    def test_empty_input_is_not_complete_inventory(self):
        result = module.audit_definitions(self.path,[])
        self.assertEqual(result['boardCount'],0)
        self.assertFalse(result['publicationAllowed'])
        self.assertNotIn('complete',result)

    def test_cli_invalid_input_has_fixed_error_without_private_details(self):
        command = [sys.executable,'-B',str(Path(__file__).with_name('audit-campaign-definitions.py')),
                   '--database',str(self.path)]
        for raw in [b'PRIVATE invalid JSON',b'x' * 65537]:
            result = subprocess.run(command,input=raw,capture_output=True,timeout=15)
            self.assertEqual(result.returncode,1)
            self.assertEqual(result.stdout,b'')
            self.assertEqual(result.stderr.decode().strip(),'campaign_definition_audit_failed')

    def test_cli_structural_input_only_and_valid_output(self):
        result = subprocess.run([sys.executable,'-B',str(Path(__file__).with_name('audit-campaign-definitions.py')),
            '--database',str(self.path)],input=json.dumps([self.board]).encode(),capture_output=True,timeout=15)
        self.assertEqual(result.returncode,0)
        self.assertEqual(json.loads(result.stdout)['alignedBoards'],1)
        self.assertEqual(result.stderr,b'')


if __name__ == '__main__':
    unittest.main()
