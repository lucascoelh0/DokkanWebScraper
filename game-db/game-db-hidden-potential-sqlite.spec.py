"""Self-contained bridge tests use SQLite :memory:, never alter the pinned database."""
import importlib.util
import json
import pathlib
import sqlite3
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('hipo_bridge', HERE/'game-db-hidden-potential-sqlite.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


def fixture():
    c = sqlite3.connect(':memory:')
    schemas = {
        'cards': 'id,hp_init,hp_max,atk_init,atk_max,def_init,def_max,lv_max,skill_lv_max,grow_type,optimal_awakening_grow_type,potential_board_id,rarity,is_selling_only,open_at',
        'potential_boards': 'id', 'potential_squares': 'id,potential_board_id,event_id,condition_set_id,is_locked,route',
        'potential_events': 'id,type,currency_id,additional_value', 'potential_event_selections': 'id,selection_table_id,event_id',
        'potential_event_selection_tables': 'id', 'potential_square_conditions': 'id,type,conditions',
        'potential_square_condition_sets': 'id', 'potential_square_condition_set_relations': 'id,condition_set_id,condition_id',
        'potential_items': 'id', 'potential_skills': 'id', 'potential_square_relations': 'id,potential_square_id,prev_potential_square_id',
        'card_growths': 'id,grow_type,lv,coef', 'optimal_awakening_growths': 'id,optimal_awakening_grow_type,step,lv_max,skill_lv_max',
        'card_awakening_routes': 'id,type,card_id,awaked_card_id,optimal_awakening_step,optimal_awakening_type,open_at',
    }
    for table, fields in schemas.items():
        c.execute('CREATE TABLE '+table+' ('+fields+')')
    def insert(table, row):
        c.execute('INSERT INTO '+table+' VALUES ('+','.join('?' for _ in row)+')', row)
    insert('cards', [100,10,100,10,100,10,100,120,10,1,1,20,4,0,'2020-01-01 00:00:00'])
    insert('potential_boards', [20]); insert('potential_square_condition_sets', [1])
    insert('potential_square_conditions', [1,'PotentialSquareCondition::SkillLv','{"skill_lv":1}'])
    insert('potential_square_condition_set_relations', [1,1,1])
    insert('potential_events', [1,'PotentialEvent::Hp',None,1])
    insert('potential_events', [2,'PotentialEvent::Select',1,0])
    insert('potential_events', [3,'PotentialEvent::Skill',1,3]); insert('potential_events', [4,'PotentialEvent::Skill',2,3])
    insert('potential_event_selection_tables', [1]); insert('potential_skills', [1]); insert('potential_skills', [2])
    insert('potential_event_selections', [1,1,3]); insert('potential_event_selections', [2,1,4])
    insert('potential_items', [1]); insert('card_growths', [1,1,120,1.0])
    insert('optimal_awakening_growths', [1,1,1,140,15])
    insert('card_awakening_routes', [1,'CardAwakeningRoute::Optimal',100,100,1,1,'2020-01-01 00:00:00'])
    raw = json.loads((HERE/'fixtures/hidden-potential/source.json').read_text())
    board = next(b for b in raw['boards'] if b['id'] == 20)
    for i, n in enumerate(board['nodes']):
        insert('potential_squares', [n[0],20,2 if i == 10 else 1,1,int(n[1] is not None),n[1]])
    rel = 0
    for a, b in board['edges']:
        for pair in [(a,b),(b,a)]:
            rel += 1; insert('potential_square_relations', [rel,*pair])
    for k in board['roots']:
        rel += 1; insert('potential_square_relations', [rel,k,None])
    return c


class BridgeTests(unittest.TestCase):
    def test_valid_and_no_mutation(self):
        with fixture() as c:
            before = list(c.iterdump()); r = bridge.extract(c, [100])
            self.assertEqual(len(r['boards'][0]['nodes']), 334)
            self.assertEqual(list(c.iterdump()), before)

    def test_adversarial(self):
        cases = [
            "UPDATE potential_squares SET event_id=999 WHERE id=2",
            "UPDATE potential_squares SET condition_set_id=999 WHERE id=2",
            "UPDATE potential_squares SET potential_board_id=99 WHERE id=2",
            "UPDATE potential_squares SET route=7 WHERE id=2",
            "UPDATE potential_squares SET route=1 WHERE id=2",
            "DELETE FROM potential_square_relations WHERE id=1",
            "DELETE FROM potential_square_relations WHERE prev_potential_square_id IS NULL",
            "UPDATE potential_events SET type='PotentialEvent::Unknown' WHERE id=1",
            "UPDATE potential_events SET type='PotentialEvent::Atk' WHERE id=3",
            "DELETE FROM potential_event_selections WHERE id=2",
            "UPDATE potential_square_conditions SET conditions='{\"skill_lv\":11}'",
            "UPDATE potential_square_conditions SET type='Unknown'",
            "UPDATE potential_square_condition_set_relations SET condition_id=999",
            "UPDATE card_awakening_routes SET awaked_card_id=999",
            "UPDATE card_awakening_routes SET optimal_awakening_step=99",
            "INSERT INTO card_growths VALUES (2,1,120,1.0)",
            "UPDATE card_growths SET coef=-1",
            "ALTER TABLE optimal_awakening_growths ADD COLUMN hp_increase",
            "DROP TABLE potential_events",
        ]
        for sql in cases:
            with self.subTest(sql=sql), fixture() as c:
                c.execute(sql)
                with self.assertRaises((ValueError, sqlite3.Error)):
                    bridge.extract(c, [100])

    def test_unknown_bytes_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unknown source SHA256'):
            bridge.pinned(HERE/'fixtures/hidden-potential/source.json', bridge.DB_SHA, 1024*1024)

    def test_missing_card_is_not_zero_alias(self):
        with fixture() as c:
            self.assertEqual(bridge.extract(c, [101])['cards'], [])


if __name__ == '__main__':
    unittest.main()
