import argparse
import json
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    options = parser.parse_args()
    database = Path(options.database).resolve(strict=True)
    connection = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    connection.execute("PRAGMA query_only = ON")
    connection.row_factory = sqlite3.Row
    try:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'budokai%' ORDER BY name")}
        required = {"budokais", "budokai_missions", "budokai_box_rankings"}
        if not required.issubset(tables):
            raise RuntimeError("required structural tables missing")
        budokai_ids = [row[0] for row in connection.execute("SELECT id FROM budokais WHERE id = ? ORDER BY id", (63,))]
        mission_links = [{"missionId": row[0], "budokaiId": row[1]} for row in connection.execute("SELECT id, budokai_id FROM budokai_missions WHERE id = ? ORDER BY id", (63001,))]
        box_links = [{"boxRankingId": row[0], "budokaiId": row[1]} for row in connection.execute("SELECT id, budokai_id FROM budokai_box_rankings WHERE id = ? ORDER BY id", (631,))]
        map_table = "budokai_maps" in tables
        map_links = []
        if map_table:
            map_links = [{"mapId": row[0], "budokaiId": row[1]} for row in connection.execute("SELECT id, budokai_id FROM budokai_maps WHERE id IN (631,632,633,634) ORDER BY id")]
        result = {
            "schemaVersion": 1,
            "contract": "dokkan-world-tournament-sqlite-structural-evidence",
            "contractVersion": "0.6.0",
            "collectionMode": "private_pinned_snapshot_sqlite_uri_mode_ro_query_only",
            "identityPolicy": "numeric_structural_ids_only_no_text_columns",
            "tablePresence": {
                "budokais": True,
                "budokai_missions": True,
                "budokai_box_rankings": True,
                "budokai_maps": map_table,
            },
            "budokaiIds": budokai_ids,
            "missionLinks": mission_links,
            "boxRankingLinks": box_links,
            "mapLinks": map_links,
        }
        print(json.dumps(result, separators=(",", ":"), sort_keys=True))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
