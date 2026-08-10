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
        subcategories = []
        for row in connection.execute("SELECT id, category_type, invalid_genkai_gimmick_sub_category_ids, priority FROM genkai_gimmick_sub_categories ORDER BY id"):
            invalid_ids = json.loads(row["invalid_genkai_gimmick_sub_category_ids"])
            if not isinstance(invalid_ids, list) or any(not isinstance(value, int) for value in invalid_ids):
                raise RuntimeError("invalid subcategory relation shape")
            subcategories.append({"id": row["id"], "categoryType": row["category_type"], "invalidSubcategoryIds": invalid_ids, "priority": row["priority"]})
        score_rows = list(connection.execute("SELECT kind, conditions FROM score_benefits"))
        condition_types = set()
        distinct_conditions = set()
        for row in score_rows:
            conditions = json.loads(row["conditions"])
            if not isinstance(conditions, dict):
                raise RuntimeError("invalid score condition shape")
            distinct_conditions.add(json.dumps(conditions, sort_keys=True, separators=(",", ":")))
            for key, value in conditions.items():
                value_type = "integer" if isinstance(value, int) and not isinstance(value, bool) else "boolean" if isinstance(value, bool) else "string" if isinstance(value, str) else "array" if isinstance(value, list) else "object" if isinstance(value, dict) else "null"
                condition_types.add((key, value_type))
        special = connection.execute("SELECT COUNT(*) AS row_count, COUNT(DISTINCT efficacy_type) AS efficacy_type_count, COUNT(causality_conditions) AS non_null_causality_count FROM special_bonuses").fetchone()
        result = {
            "schemaVersion": 1,
            "contract": "dokkan-special-modes-sqlite-structural-evidence",
            "contractVersion": "0.4.1",
            "collectionMode": "sqlite_uri_mode_ro_query_only",
            "genkaiGimmickSubcategories": subcategories,
            "scoreBenefits": {"rowCount": len(score_rows), "kindCount": len({row["kind"] for row in score_rows}), "distinctConditionsCount": len(distinct_conditions), "conditionKeyTypes": [{"key": key, "type": value_type} for key, value_type in sorted(condition_types)]},
            "specialBonuses": {"rowCount": special["row_count"], "efficacyTypeCount": special["efficacy_type_count"], "nonNullCausalityCount": special["non_null_causality_count"]},
        }
        print(json.dumps(result, separators=(",", ":"), sort_keys=True))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
