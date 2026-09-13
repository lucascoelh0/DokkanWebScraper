"""Export bounded static mission definitions for an OFFLINE campaign preview.

Requires an independently selected database digest. No dates, progress or media
are exported. Standard output is definition JSON, never a production upload.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
import time

MAX_BYTES = 2 * 1024 * 1024


def positive(value):
    if type(value) is not int or not 0 < value <= 999999999:
        raise ValueError()
    return value


def text(value, limit, optional=False, multiline=False):
    if value is None and optional:
        return None
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError()
    if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]', value):
        raise ValueError()
    value = value.replace('\r\n','\n').replace('\r','\n').strip() if multiline else ' '.join(value.split())
    if not value:
        if optional:
            return None
        raise ValueError()
    return value


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def export_definitions(database, expected_sha256, selection, include_destinations=False):
    if not isinstance(expected_sha256, str) or not re.fullmatch('[a-f0-9]{64}', expected_sha256):
        raise ValueError()
    if not isinstance(selection, dict) or set(selection) != {'categoryIds', 'completionMissionIds'}:
        raise ValueError()
    for key, limit in [('categoryIds', 1000), ('completionMissionIds', 100)]:
        values = selection[key]
        if not isinstance(values, list) or len(values) > limit or any(positive(v) != v for v in values) or len(set(values)) != len(values):
            raise ValueError()
    path = Path(database).resolve(strict=True)
    def validate_file():
        if not path.is_file() or not 0 < path.stat().st_size <= 256 * 1024 * 1024:
            raise ValueError()
        if any(Path(str(path) + suffix).exists() for suffix in ('-wal', '-journal')):
            raise ValueError()
        if digest(path) != expected_sha256:
            raise ValueError()
    validate_file()
    connection = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=3)
    try:
        connection.execute('PRAGMA query_only=ON')
        connection.execute('BEGIN')
        deadline = time.monotonic() + 10
        connection.set_progress_handler(lambda: int(time.monotonic() >= deadline), 1000)
        missions, categories, reward_ids = {}, {}, set()
        columns = 'id,mission_category_id,type,name,description,priority'
        def add_mission(row):
            mission_id, category_id = positive(row[0]), positive(row[1])
            if mission_id in missions:
                return
            if len(missions) >= 5000 or type(row[5]) is not int or not 0 <= row[5] <= 999999999:
                raise ValueError()
            rewards = []
            for r in connection.execute('SELECT id,item_id,item_type,quantity FROM mission_rewards WHERE mission_id=? ORDER BY id LIMIT 20001', (mission_id,)):
                reward_id, item_id, quantity = positive(r[0]), positive(r[1]), positive(r[3])
                if reward_id in reward_ids or len(reward_ids) >= 20000 or not isinstance(r[2],str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9]*(?:::[A-Za-z][A-Za-z0-9]*)?',r[2]) or len(r[2]) > 80:
                    raise ValueError()
                reward_ids.add(reward_id)
                rewards.append(dict(id=reward_id,itemId=item_id,itemType=r[2],quantity=quantity))
            missions[mission_id] = dict(id=mission_id,categoryId=category_id,type=text(row[2],80),
                name=text(row[3],256),description=text(row[4],4096,True,True),priority=row[5],rewards=rewards)
            if include_destinations:
                link = connection.execute('SELECT link_to FROM missions WHERE id=?', (mission_id,)).fetchone()[0]
                match = re.fullmatch(r'internal:EventTopScene:([1-9][0-9]{0,8})', link or '')
                destination = None
                if match:
                    area_id = positive(int(match.group(1)))
                    area = connection.execute('SELECT id FROM areas WHERE id=?', (area_id,)).fetchone()
                    if area:
                        destination = dict(type='event-area', areaId=area_id)
                missions[mission_id]['destination'] = destination
        for category in sorted(selection['categoryIds']):
            for row in connection.execute('SELECT ' + columns + ' FROM missions WHERE mission_category_id=? ORDER BY id LIMIT 5001', (category,)):
                if row[0] in missions:
                    raise ValueError()
                add_mission(row)
        for mission in sorted(selection['completionMissionIds']):
            rows = connection.execute('SELECT ' + columns + ' FROM missions WHERE id=? LIMIT 2', (mission,)).fetchall()
            if len(rows) != 1:
                raise ValueError()
            add_mission(rows[0])
        category_ids = set(selection['categoryIds']) | {m['categoryId'] for m in missions.values()}
        if len(category_ids) > 1000:
            raise ValueError()
        for category in sorted(category_ids):
            rows = connection.execute('SELECT id,name FROM mission_categories WHERE id=? LIMIT 2', (category,)).fetchall()
            if len(rows) != 1:
                raise ValueError()
            categories[category] = dict(id=positive(rows[0][0]),name=text(rows[0][1],256))
        payload = dict(schemaVersion=2 if include_destinations else 1,contract='dokkan-campaign-definitions',source='dokkan-game-db',
            databaseSha256=expected_sha256,categories=list(categories.values()),
            missions=[missions[k] for k in sorted(missions)])
        result = json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode('utf-8')
        if len(result) > MAX_BYTES:
            raise ValueError()
        validate_file()
        return result
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--database-sha256', required=True)
    parser.add_argument('--include-destinations', action='store_true')
    args = parser.parse_args()
    try:
        raw = sys.stdin.buffer.read(65537)
        if len(raw) > 65536:
            raise ValueError()
        result = export_definitions(args.database,args.database_sha256,json.loads(raw.decode('utf-8')),args.include_destinations)
        sys.stdout.buffer.write(result)
    except Exception:
        print('campaign_definition_export_failed',file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
