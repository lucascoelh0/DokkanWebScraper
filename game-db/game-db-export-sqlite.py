import argparse
import csv
import os
import sqlite3


def export_table(cursor: sqlite3.Cursor, table_name: str, output_path: str) -> None:
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    if not columns:
        raise RuntimeError(f"Table not found or has no columns: {table_name}")

    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(columns)
        for row in rows:
            writer.writerow(["" if value is None else value for value in row])


def main() -> None:
    parser = argparse.ArgumentParser(description="Export selected Dokkan SQLite tables to CSV.")
    parser.add_argument("--sqlite-path", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--table", action="append", dest="tables", required=True)
    args = parser.parse_args()

    connection = sqlite3.connect(args.sqlite_path)
    try:
        cursor = connection.cursor()
        for table_name in args.tables:
            output_path = os.path.join(args.output_dir, f"{table_name}.csv")
            export_table(cursor, table_name, output_path)
            print(f"Exported {table_name} -> {output_path}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
