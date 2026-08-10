import hashlib
import json
import sys
import zipfile

MAGIC = b"\x37\xa4\x30\xec"

def occurrences(data):
    out = []
    offset = 0
    while True:
        offset = data.find(MAGIC, offset)
        if offset < 0:
            return out
        dictionary_id = int.from_bytes(data[offset + 4:offset + 8], "little") if offset + 8 <= len(data) else -1
        out.append((offset, dictionary_id))
        offset += 1

def candidate(role, source, archive_entry, data, offset, dictionary_id):
    whole = offset == 0
    return {
        "artifactRole": role,
        "source": source,
        "archiveEntry": archive_entry,
        "offset": offset,
        "dictionaryId": dictionary_id,
        "identityStatus": ("whole_file_dictionary" if source == "file" else "whole_archive_entry_dictionary") if whole else "embedded_header_length_unknown",
        "sizeBytes": len(data) if whole else None,
        "sha256": hashlib.sha256(data).hexdigest() if whole else None,
    }

def main():
    request = json.load(sys.stdin)
    scans = []
    candidates = []
    for artifact in request["artifacts"]:
        with open(artifact["path"], "rb") as handle:
            raw = handle.read()
        raw_hits = occurrences(raw)
        candidates.extend(candidate(artifact["role"], "file", None, raw, offset, did) for offset, did in raw_hits)
        entry_count = 0
        expanded = 0
        archive_hits = 0
        if artifact["scanArchiveEntries"] and zipfile.is_zipfile(artifact["path"]):
            with zipfile.ZipFile(artifact["path"], "r") as archive:
                for info in archive.infolist():
                    if info.is_dir():
                        continue
                    entry_count += 1
                    data = archive.read(info)
                    expanded += len(data)
                    hits = occurrences(data)
                    archive_hits += len(hits)
                    candidates.extend(candidate(artifact["role"], "archive_entry", info.filename, data, offset, did) for offset, did in hits)
        scans.append({"artifactRole": artifact["role"], "sizeBytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "archiveEntryCount": entry_count, "archiveExpandedBytes": expanded, "dictionaryHeaderCount": len(raw_hits) + archive_hits})
    json.dump({"scans": scans, "candidates": candidates}, sys.stdout, separators=(",", ":"))

if __name__ == "__main__":
    main()
