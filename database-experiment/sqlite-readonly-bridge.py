import argparse
import json
from pathlib import Path
import sqlite3
import sys


def open_read_only(path: str) -> sqlite3.Connection:
    uri = Path(path).resolve().as_uri() + "?mode=ro&immutable=1"
    connection = sqlite3.connect(uri, uri=True)
    connection.execute("PRAGMA query_only=ON")
    connection.row_factory = sqlite3.Row
    return connection


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def inspect_database(connection: sqlite3.Connection) -> dict:
    tables = []
    names = [row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    )]
    for name in names:
        columns = [row[1] for row in connection.execute(
            f"PRAGMA table_info({quote_identifier(name)})"
        )]
        row_count = connection.execute(
            f"SELECT COUNT(*) FROM {quote_identifier(name)}"
        ).fetchone()[0]
        tables.append({"name": name, "columns": columns, "rowCount": row_count})
    return {"tableCount": len(tables), "tables": tables}


def read_table(connection: sqlite3.Connection, table: str, columns: list[str]) -> list[dict]:
    available = [row[1] for row in connection.execute(
        f"PRAGMA table_info({quote_identifier(table)})"
    )]
    if not available:
        raise RuntimeError(f"Unknown table: {table}")
    missing = [column for column in columns if column not in available]
    if missing:
        raise RuntimeError(f"Unknown column(s) in {table}: {', '.join(missing)}")
    selected = ", ".join(quote_identifier(column) for column in columns)
    order_column = "id" if "id" in columns else columns[0]
    query = (
        f"SELECT {selected} FROM {quote_identifier(table)} "
        f"ORDER BY {quote_identifier(order_column)}"
    )
    return [dict(row) for row in connection.execute(query)]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["inspect", "read-table"])
    parser.add_argument("--database", required=True)
    parser.add_argument("--table")
    parser.add_argument("--column", action="append", dest="columns")
    args = parser.parse_args()

    connection = open_read_only(args.database)
    try:
        if args.command == "inspect":
            result = inspect_database(connection)
        else:
            if not args.table or not args.columns:
                raise RuntimeError("read-table requires --table and at least one --column")
            result = read_table(connection, args.table, args.columns)
        json.dump(result, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
