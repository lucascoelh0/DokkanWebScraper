"""Pinned, read-only HIPO bridge. No writes, network, account data or fallback source."""
import argparse
import hashlib
import json
import math
import pathlib
import sqlite3
import sys

DB_SHA = '7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495'
ELF_SHA = 'a1592e635bad24ef270fa3a28383a3032effd5f4709c17dd2acde1f7fd7e38f7'
LAYOUT_SHA = {20: 'e141e5dd3a5cfe0a262dda33ff5e597db4ed08fa0e7fb66c082d067c0059e289',
              201: '2085e731c7106742f848dfacad56eaf5dcd05e4e225dc55b3b80876078aeef86'}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def integer(v, label, minimum=0, maximum=2147483647):
    require(type(v) is int and minimum <= v <= maximum, 'Invalid integer: '+label)
    return v


def rows(c, table, fields):
    # Identifiers are module constants, never CLI or data strings.
    columns = {r[1] for r in c.execute('PRAGMA table_info('+table+')')}
    require(set(fields.split(',')) <= columns, 'Missing schema: '+table)
    require(not any(k.endswith('_increase') for k in columns), 'Unsupported *_increase schema: '+table)
    result = [dict(r) for r in c.execute('SELECT '+fields+' FROM '+table+' ORDER BY id')]
    require(len(result) <= 100000, 'Table too large: '+table)
    return result


def index(values, label):
    out = {}
    for r in values:
        k = integer(r['id'], label, 1)
        require(k not in out, 'Duplicate '+label)
        out[k] = r
    return out


def extract(c, ids):
    """Separately testable using an in-memory SQLite fixture; production CLI pins bytes."""
    c.row_factory = sqlite3.Row
    cards = index(rows(c, 'cards', 'id,hp_init,hp_max,atk_init,atk_max,def_init,def_max,lv_max,skill_lv_max,grow_type,optimal_awakening_grow_type,potential_board_id,rarity,is_selling_only,open_at'), 'card')
    boards = index(rows(c, 'potential_boards', 'id'), 'board')
    squares = index(rows(c, 'potential_squares', 'id,potential_board_id,event_id,condition_set_id,is_locked,route'), 'square')
    events = index(rows(c, 'potential_events', 'id,type,currency_id,additional_value'), 'event')
    selections = rows(c, 'potential_event_selections', 'id,selection_table_id,event_id')
    selection_tables = index(rows(c, 'potential_event_selection_tables', 'id'), 'selection table')
    conditions = index(rows(c, 'potential_square_conditions', 'id,type,conditions'), 'condition')
    sets = index(rows(c, 'potential_square_condition_sets', 'id'), 'condition set')
    condition_relations = rows(c, 'potential_square_condition_set_relations', 'id,condition_set_id,condition_id')
    items = index(rows(c, 'potential_items', 'id'), 'item')
    skills = index(rows(c, 'potential_skills', 'id'), 'skill')
    relations = rows(c, 'potential_square_relations', 'id,potential_square_id,prev_potential_square_id')
    growths = rows(c, 'card_growths', 'id,grow_type,lv,coef')
    optimal = rows(c, 'optimal_awakening_growths', 'id,optimal_awakening_grow_type,step,lv_max,skill_lv_max')
    routes = rows(c, 'card_awakening_routes', 'id,type,card_id,awaked_card_id,optimal_awakening_step,optimal_awakening_type,open_at')
    for label, values in [('selection', selections), ('condition relation', condition_relations), ('relation', relations), ('growth', growths), ('optimal', optimal), ('route', routes)]:
        index(values, label)
    for e in events.values():
        require(e['type'] in ['PotentialEvent::'+t for t in ['Hp', 'Atk', 'Defense', 'Skill', 'Select']], 'Unknown potential event')
        integer(e['additional_value'], 'event value', 0, 100000)
        if e['type'] == 'PotentialEvent::Skill':
            require(e['currency_id'] in skills and e['additional_value'] > 0, 'Unknown skill event')
        if e['type'] == 'PotentialEvent::Select':
            require(e['currency_id'] in selection_tables, 'Missing selection table')
    choice_counts = {}
    choice_pairs = set()
    for r in selections:
        t, e = r['selection_table_id'], r['event_id']
        require(t in selection_tables and e in events and events[e]['type'] == 'PotentialEvent::Skill', 'Invalid skill choice')
        require((t, e) not in choice_pairs, 'Duplicate choice')
        choice_pairs.add((t, e)); choice_counts[t] = choice_counts.get(t, 0)+1
    for t in selection_tables:
        require(choice_counts.get(t, 0) >= 2, 'Incomplete choices')
    sa = {}
    for k, r in conditions.items():
        data = json.loads(r['conditions'])
        if r['type'] == 'PotentialSquareCondition::SkillLv':
            require(isinstance(data, dict) and set(data) == {'skill_lv'}, 'Invalid SA condition')
            sa[k] = integer(data['skill_lv'], 'SA condition', 1, 10)
        elif r['type'] == 'PotentialSquareCondition::PotentialItem':
            require(isinstance(data, dict) and set(data) == {'item_id', 'quantity'}, 'Invalid orb condition')
            require(data['item_id'] in items, 'Missing orb')
            integer(data['quantity'], 'orb quantity', 1)
            sa[k] = 0
        else:
            raise ValueError('Unknown potential condition')
    set_sa = {}; condition_pairs = set()
    for r in condition_relations:
        s, k = r['condition_set_id'], r['condition_id']
        require(s in sets and k in conditions and (s, k) not in condition_pairs, 'Invalid condition join')
        condition_pairs.add((s, k)); set_sa[s] = max(set_sa.get(s, 0), sa[k])
    require(set(set_sa) == set(sets), 'Empty condition set')
    out_boards = {k: {'id': k, 'nodes': [], 'roots': [], 'edges': []} for k in boards}
    for k, s in squares.items():
        require(s['potential_board_id'] in boards and s['event_id'] in events and s['condition_set_id'] in sets, 'Missing square join')
        require(type(s['is_locked']) is int and s['is_locked'] in (0, 1), 'Invalid lock')
        require((s['is_locked'] == 0 and s['route'] is None) or (s['is_locked'] == 1 and type(s['route']) is int and s['route'] in range(4)), 'Invalid gate route')
        e = events[s['event_id']]
        bonus = [e['additional_value'] if e['type'] == 'PotentialEvent::'+axis else 0 for axis in ['Hp', 'Atk', 'Defense']]
        out_boards[s['potential_board_id']]['nodes'].append({'id': k, 'route': s['route'], 'bonus': bonus, 'requiredSa': set_sa[s['condition_set_id']], 'choiceCount': choice_counts[e['currency_id']] if e['type'] == 'PotentialEvent::Select' else 0})
    pairs = set(); root_ids = set()
    for r in relations:
        a, b = r['potential_square_id'], r['prev_potential_square_id']
        require(a in squares, 'Missing relation square')
        board = squares[a]['potential_board_id']
        if b is None:
            require(a not in root_ids, 'Duplicate root'); root_ids.add(a)
            out_boards[board]['roots'].append(a)
        else:
            require(b in squares and a != b and squares[b]['potential_board_id'] == board and (a, b) not in pairs, 'Invalid relation')
            pairs.add((a, b))
            if a < b:
                out_boards[board]['edges'].append([a, b])
    require(all((b, a) in pairs for a, b in pairs), 'Asymmetric relations')
    for board in out_boards.values():
        ns = {n['id']: n for n in board['nodes']}
        require(len(ns) == 334 and len(board['roots']) == 4, 'Unknown board cardinality')
        require(sorted(n['route'] for n in ns.values() if n['route'] is not None) == [0, 1, 2, 3], 'Invalid board gates')
        require(all(ns[k]['route'] is None for k in board['roots']), 'Gate cannot be root')
        adjacency = {k: [] for k in ns}
        for a, b in board['edges']:
            adjacency[a].append(b); adjacency[b].append(a)
        reached = set(); todo = list(board['roots'])
        while todo:
            k = todo.pop()
            if k not in reached:
                reached.add(k); todo.extend(adjacency[k])
        require(len(reached) == 334, 'Disconnected board')
    curve_keys = set()
    for r in growths:
        integer(r['grow_type'], 'grow type', 1); integer(r['lv'], 'growth level', 1, 1000)
        require(type(r['coef']) in (int, float) and math.isfinite(r['coef']) and r['coef'] >= 0, 'Invalid coefficient')
        key = (r['grow_type'], r['lv']); require(key not in curve_keys, 'Duplicate growth key'); curve_keys.add(key)
    optimal_keys = set()
    for r in optimal:
        key = (integer(r['optimal_awakening_grow_type'], 'optimal type', 1), integer(r['step'], 'step', 1, 100))
        require(key not in optimal_keys, 'Duplicate optimal key'); optimal_keys.add(key)
        integer(r['lv_max'], 'optimal level', 1, 1000); integer(r['skill_lv_max'], 'optimal SA', 1, 100)
    wanted = set(ids); selected = []; selected_routes = []
    require(len(wanted) == len(ids) and len(ids) <= 10000 and all(type(k) is int and k > 0 for k in ids), 'Invalid scoped IDs')
    for k in sorted(wanted):
        if k not in cards:
            continue  # Explicit missing-card status emitted by engine, never an alias.
        card = cards[k]
        for axis in ['hp', 'atk', 'def']:
            integer(card[axis+'_init'], 'initial stat'); integer(card[axis+'_max'], 'max stat')
            require(card[axis+'_max'] >= card[axis+'_init'], 'Decreasing stat bounds')
        integer(card['lv_max'], 'base level', 1, 1000); integer(card['skill_lv_max'], 'base SA', 1, 100)
        integer(card['grow_type'], 'card curve', 1)
        integer(card['rarity'], 'rarity', 0, 5); integer(card['is_selling_only'], 'selling-only flag', 0, 1)
        if card['potential_board_id'] is not None:
            require(card['potential_board_id'] in boards, 'Unknown card board')
        selected.append(card)
    for r in routes:
        if r['card_id'] not in wanted or r['type'] != 'CardAwakeningRoute::Optimal':
            continue
        require(r['card_id'] in cards and r['awaked_card_id'] == r['card_id'], 'Optimal identity mismatch')
        require(type(r['optimal_awakening_type']) is int and r['optimal_awakening_type'] in (1, 2), 'Unknown optimal state')
        key = (cards[r['card_id']]['optimal_awakening_grow_type'], r['optimal_awakening_step'])
        require(key in optimal_keys, 'Missing optimal growth join')
        selected_routes.append(r)
    return {'cards': selected, 'boards': list(out_boards.values()), 'growths': growths, 'optimal': optimal, 'routes': selected_routes}


def pinned(path, digest, limit):
    p = pathlib.Path(path).resolve(strict=True)
    require(p.is_file() and 0 < p.stat().st_size <= limit, 'Invalid source file')
    b = p.read_bytes()
    require(hashlib.sha256(b).hexdigest() == digest, 'Unknown source SHA256: '+p.name)
    return p, b


def main():
    parser = argparse.ArgumentParser(allow_abbrev=False)
    for name in ['db', 'elf', 'layout20', 'layout201']:
        parser.add_argument('--'+name, required=True)
    args = parser.parse_args()
    db, db_bytes = pinned(args.db, DB_SHA, 128*1024*1024)
    _, elf_bytes = pinned(args.elf, ELF_SHA, 128*1024*1024)
    layout_bytes = {k: pinned(getattr(args, 'layout'+str(k)), h, 256*1024)[1] for k, h in LAYOUT_SHA.items()}
    text = sys.stdin.buffer.read(256*1024+1)
    require(len(text) <= 256*1024, 'Scope too large')
    ids = json.loads(text)
    require(isinstance(ids, list), 'Expected scoped ID array')
    # URI mode=ro and query_only are both deliberate; no temporary DB or copy.
    with sqlite3.connect(db.as_uri()+'?mode=ro', uri=True) as c:
        c.execute('PRAGMA query_only=ON')
        require(c.execute('PRAGMA quick_check').fetchone()[0] == 'ok', 'SQLite integrity failure')
        result = extract(c, ids)
    for board in result['boards']:
        if board['id'] not in layout_bytes:
            continue
        j = json.loads(layout_bytes[board['id']]); nodes = {int(k): v for k, v in j['nodes'].items()}
        centers = {k for k, v in nodes.items() if v['type'] == 'start'}
        require(len(nodes) == 335 and len(centers) == 1 and set(nodes)-centers == {n['id'] for n in board['nodes']}, 'Layout node mismatch')
        edges = {tuple(sorted(e['nodes'])) for e in j['edges'].values()}
        require({e for e in edges if not centers.intersection(e)} == {tuple(e) for e in board['edges']}, 'Layout edge mismatch')
        require({k for e in edges if centers.intersection(e) for k in e if k not in centers} == set(board['roots']), 'Layout roots mismatch')
        center = nodes[next(iter(centers))]
        expected = {0: (-1, 1), 1: (1, 1), 2: (-1, -1), 3: (1, -1)}
        for n in board['nodes']:
            if n['route'] is not None:
                p = nodes[n['id']]; dx, dy = expected[n['route']]
                require((p['x']-center['x'])*dx > 0 and (p['y']-center['y'])*dy > 0, 'Layout gate orientation mismatch')
    # Detect source replacement/mutation during reading before emitting anything.
    pinned(args.db, DB_SHA, 128*1024*1024)
    result['provenance'] = {'databaseSha256': DB_SHA, 'runtimeSha256': ELF_SHA, 'snapshotVersion': '1788329250', 'layoutJsonSha256': {str(k): v for k, v in LAYOUT_SHA.items()}}
    result['provenance']['files'] = [{'role': 'database', 'sha256': DB_SHA, 'sizeBytes': len(db_bytes)},
                                     {'role': 'runtime', 'sha256': ELF_SHA, 'sizeBytes': len(elf_bytes)}] + [
        {'role': 'layout-json-'+str(k), 'sha256': LAYOUT_SHA[k], 'sizeBytes': len(raw)} for k, raw in layout_bytes.items()]
    print(json.dumps(result, ensure_ascii=True, separators=(',', ':'), allow_nan=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('HIPO bridge rejected source: '+str(error), file=sys.stderr)
        sys.exit(1)
