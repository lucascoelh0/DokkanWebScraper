"""Offline, read-only evidence for board/category/completion/reward joins.

Input is a small structural board list, never a HAR or account progress payload.
This audit does not establish current availability or authorize publication.
"""
import argparse
import json
from pathlib import Path
import sqlite3
import sys
import time


def audit_definitions(database, boards):
    if not isinstance(boards, list) or len(boards) > 1000:
        raise ValueError('invalid_board_definitions')
    ids = set()
    fields = ('id', 'mission_category_id', 'complete_mission_id', 'display_reward_id')
    for board in boards:
        if not isinstance(board, dict) or any(type(board.get(k)) is not int or not 0 < board[k] <= 999999999 for k in fields):
            raise ValueError('invalid_board_definitions')
        if board['id'] in ids:
            raise ValueError('invalid_board_definitions')
        ids.add(board['id'])
    path = Path(database).resolve(strict=True)
    if not path.is_file() or path.stat().st_size > 256 * 1024 * 1024:
        raise ValueError('invalid_definition_database')
    connection = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=3)
    try:
        connection.execute('PRAGMA query_only=ON')
        deadline = time.monotonic() + 10
        connection.set_progress_handler(lambda: int(time.monotonic() >= deadline), 1000)
        result = dict(mode='offline-definition-audit', publicationAllowed=False,
                      boardCount=len(boards), categoryMatched=0, completionMatched=0,
                      displayRewardMatched=0, completionCategoryMatched=0,
                      displayCompletionMatched=0, alignedBoards=0)
        categories = set()
        for board in boards:
            category = connection.execute('SELECT id FROM mission_categories WHERE id=?', (board['mission_category_id'],)).fetchall()
            completion = connection.execute('SELECT mission_category_id FROM missions WHERE id=?', (board['complete_mission_id'],)).fetchall()
            reward = connection.execute('SELECT mission_id FROM mission_rewards WHERE id=?', (board['display_reward_id'],)).fetchall()
            category_ok, completion_ok, reward_ok = len(category) == 1, len(completion) == 1, len(reward) == 1
            completion_aligned = completion_ok and completion[0][0] == board['mission_category_id']
            reward_aligned = reward_ok and reward[0][0] == board['complete_mission_id']
            result['categoryMatched'] += int(category_ok)
            result['completionMatched'] += int(completion_ok)
            result['displayRewardMatched'] += int(reward_ok)
            result['completionCategoryMatched'] += int(completion_aligned)
            result['displayCompletionMatched'] += int(reward_aligned)
            result['alignedBoards'] += int(category_ok and completion_aligned and reward_aligned)
            if category_ok:
                categories.add(board['mission_category_id'])
        result['uniqueCategories'] = len(categories)
        result['categoryMissionCount'] = sum(connection.execute('SELECT count(*) FROM missions WHERE mission_category_id=?', (c,)).fetchone()[0] for c in categories)
        result['categoryRewardCount'] = sum(connection.execute('SELECT count(*) FROM mission_rewards r JOIN missions m ON m.id=r.mission_id WHERE m.mission_category_id=?', (c,)).fetchone()[0] for c in categories)
        return result
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    args = parser.parse_args()
    try:
        raw = sys.stdin.buffer.read(65537)
        if len(raw) > 65536:
            raise ValueError()
        boards = json.loads(raw.decode('utf-8'))
        print(json.dumps(audit_definitions(args.database, boards), sort_keys=True))
    except Exception:
        # Never echo user input, DB text, absolute paths or parser errors.
        print('campaign_definition_audit_failed', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
