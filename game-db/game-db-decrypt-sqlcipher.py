import argparse
import os
from typing import Optional

import sqlcipher3


def apply_key(cursor: sqlcipher3.Cursor, key: str, key_mode: str) -> None:
    escaped_key = key.replace("'", "''")
    if key_mode == "hex":
        cursor.execute(f"PRAGMA key = \"x'{escaped_key}'\"")
        return

    cursor.execute(f"PRAGMA key = '{escaped_key}'")


def verify_encrypted_database(cursor: sqlcipher3.Cursor) -> None:
    cursor.execute("SELECT count(*) FROM sqlite_master")
    cursor.fetchone()


def decrypt_database(
    input_path: str,
    output_path: str,
    key: str,
    cipher_compatibility: Optional[int],
    key_mode: str,
) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    escaped_output_path = output_path.replace("'", "''")

    if os.path.exists(output_path):
        os.remove(output_path)

    connection = sqlcipher3.connect(input_path)
    try:
        cursor = connection.cursor()
        apply_key(cursor, key, key_mode)

        if cipher_compatibility is not None:
            cursor.execute(f"PRAGMA cipher_compatibility = {cipher_compatibility}")

        verify_encrypted_database(cursor)
        cursor.execute(f"ATTACH DATABASE '{escaped_output_path}' AS decrypted KEY ''")
        cursor.execute("SELECT sqlcipher_export('decrypted')")
        cursor.execute("DETACH DATABASE decrypted")
        connection.commit()
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Decrypt a Dokkan SQLCipher database artifact into plain SQLite.")
    parser.add_argument("--input-path", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--key-mode", choices=["text", "hex"], default="text")
    parser.add_argument("--cipher-compatibility", type=int, default=3)
    args = parser.parse_args()

    decrypt_database(
        input_path=args.input_path,
        output_path=args.output_path,
        key=args.key,
        cipher_compatibility=args.cipher_compatibility,
        key_mode=args.key_mode,
    )

    print(f"Decrypted SQLite written to {args.output_path}")


if __name__ == "__main__":
    main()
