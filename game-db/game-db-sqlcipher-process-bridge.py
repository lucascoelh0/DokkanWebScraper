import argparse
import hashlib
import os
import sqlite3
import struct
import sys


PROTOCOL = "dq6-sqlcipher-bridge-v1"
PROTOCOL_MAGIC = b"DQ6SQL01"
MAX_DATABASE_BYTES = 112 * 1024 * 1024
MAX_SECRET_BYTES = 64 * 1024
CHUNK_BYTES = 64 * 1024


def contained_file(directory: str, name: str) -> str:
    path = os.path.abspath(os.path.join(directory, name))
    if os.path.dirname(path) != directory or os.path.realpath(path) != path:
        raise RuntimeError("invalid controlled path")
    return path


def write_exclusive_from_pipe(fd: int, path: str, limit: int) -> int:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_BINARY"):
        flags |= os.O_BINARY
    output_fd = os.open(path, flags, 0o600)
    total = 0
    try:
        with os.fdopen(fd, "rb", buffering=0, closefd=True) as source:
            while True:
                chunk = source.read(CHUNK_BYTES)
                if not chunk:
                    break
                if total > limit - len(chunk):
                    raise RuntimeError("input limit")
                view = memoryview(chunk)
                while view:
                    written = os.write(output_fd, view)
                    if written <= 0:
                        raise RuntimeError("input write")
                    view = view[written:]
                total += len(chunk)
        os.fsync(output_fd)
    finally:
        os.close(output_fd)
    if total <= 0:
        raise RuntimeError("empty input")
    return total


def read_secret(fd: int) -> bytearray:
    secret = bytearray()
    with os.fdopen(fd, "rb", buffering=0, closefd=True) as source:
        while len(secret) <= MAX_SECRET_BYTES:
            chunk = source.read(min(CHUNK_BYTES, MAX_SECRET_BYTES + 1 - len(secret)))
            if not chunk:
                break
            secret.extend(chunk)
    if len(secret) < 8 or len(secret) > MAX_SECRET_BYTES:
        raise RuntimeError("invalid secret")
    return secret


def apply_key(cursor, secret: bytearray, encoding: str) -> None:
    if encoding == "raw_bytes":
        expression = f'"x\'{bytes(secret).hex()}\'"'
    else:
        text = bytes(secret).decode("utf-8", errors="strict")
        if "\x00" in text:
            raise RuntimeError("invalid passphrase")
        expression = "'" + text.replace("'", "''") + "'"
    try:
        cursor.execute(f"PRAGMA key = {expression}")
    finally:
        expression = ""


def validate_plain_sqlite(path: str) -> tuple[int, str]:
    size = os.path.getsize(path)
    if size <= 0 or size > MAX_DATABASE_BYTES:
        raise RuntimeError("output limit")
    digest = hashlib.sha256()
    with open(path, "rb", buffering=0) as source:
        header = source.read(112)
        digest.update(header)
        while True:
            chunk = source.read(CHUNK_BYTES)
            if not chunk:
                break
            digest.update(chunk)
    if len(header) < 112 or header[:16] != b"SQLite format 3\x00":
        raise RuntimeError("invalid output header")
    encoded_page_size = int.from_bytes(header[16:18], "big")
    page_size = 65536 if encoded_page_size == 1 else encoded_page_size
    if page_size < 512 or page_size > 65536 or page_size & (page_size - 1) or size % page_size:
        raise RuntimeError("invalid output pages")
    uri = "file:" + path.replace("?", "%3f").replace("#", "%23") + "?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        connection.execute("SELECT count(*) FROM sqlite_master").fetchone()
        check = connection.execute("PRAGMA quick_check").fetchone()
        if not check or check[0] != "ok":
            raise RuntimeError("plain SQLite quick_check failed")
    finally:
        connection.close()
    return size, digest.hexdigest()


def stream_protocol(path: str, size: int, sha256: str) -> None:
    output = os.fdopen(1, "wb", buffering=0, closefd=False)
    output.write(PROTOCOL_MAGIC + struct.pack(">Q", size) + bytes.fromhex(sha256))
    with open(path, "rb", buffering=0) as source:
        while True:
            chunk = source.read(CHUNK_BYTES)
            if not chunk:
                break
            output.write(chunk)
    output.flush()


def run() -> None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--protocol", required=True, choices=[PROTOCOL])
    parser.add_argument("--secret-encoding", required=True, choices=["utf8_passphrase", "raw_bytes"])
    parser.add_argument("--cipher-compatibility", required=True, type=int, choices=[3, 4])
    parser.add_argument("--work-directory", required=True)
    args = parser.parse_args()

    work_directory = os.path.abspath(args.work_directory)
    work_stat = os.lstat(work_directory)
    if not os.path.isdir(work_directory) or os.path.islink(work_directory) or os.path.realpath(work_directory) != work_directory:
        raise RuntimeError("invalid work directory")
    if hasattr(work_stat, "st_nlink") and work_stat.st_nlink < 1:
        raise RuntimeError("invalid work directory identity")

    input_path = contained_file(work_directory, "input.db")
    output_path = contained_file(work_directory, "output.sqlite")
    secret = bytearray()
    connection = None
    try:
        write_exclusive_from_pipe(3, input_path, MAX_DATABASE_BYTES)
        secret = read_secret(4)

        output_flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_BINARY"):
            output_flags |= os.O_BINARY
        output_fd = os.open(output_path, output_flags, 0o600)
        os.close(output_fd)

        # This bridge can best-effort zero only the bytearray it owns below.
        # Immutable Python objects and copies made by sqlcipher3/SQLCipher cannot
        # be zeroed here; an approved short-lived runtime remains TBC.
        import sqlcipher3

        connection = sqlcipher3.connect(input_path)
        cursor = connection.cursor()
        cursor.execute(f"PRAGMA cipher_compatibility = {args.cipher_compatibility}")
        apply_key(cursor, secret, args.secret_encoding)
        cursor.execute("SELECT count(*) FROM sqlite_master").fetchone()
        escaped_output = output_path.replace("'", "''")
        cursor.execute(f"ATTACH DATABASE '{escaped_output}' AS dq6_plain KEY ''")
        cursor.execute("SELECT sqlcipher_export('dq6_plain')")
        cursor.execute("DETACH DATABASE dq6_plain")
        connection.commit()
        connection.close()
        connection = None

        size, sha256 = validate_plain_sqlite(output_path)
        stream_protocol(output_path, size, sha256)
    finally:
        if connection is not None:
            connection.close()
        for index in range(len(secret)):
            secret[index] = 0
        for path in (output_path, input_path):
            try:
                os.remove(path)
            except FileNotFoundError:
                pass


if __name__ == "__main__":
    try:
        run()
    except BaseException:
        os._exit(70)
