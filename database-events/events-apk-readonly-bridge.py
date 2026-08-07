import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import sys
import zipfile


SAMPLES = [
    "assets/database.db",
    "assets/bgm/bgm_009.acb",
    "assets/bgm/bgm_009.awb",
    "assets/layout/en/image/mypage.cpk",
    "assets/outgame/effect/myp_11000.cpk",
    "assets/character/card/0000000.cpk",
    "assets/ingame/battle/character/00000.cpk",
]


def entry_hash(archive, info):
    digest = hashlib.sha256()
    with archive.open(info) as source:
        while True:
            chunk = source.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", required=True)
    args = parser.parse_args()
    apk = Path(args.apk).resolve()
    with zipfile.ZipFile(apk) as archive:
        infos = archive.infolist()
        files = {info.filename: info for info in infos if not info.is_dir()}
        asset_entries = sorted(name for name in files if name.startswith("assets/"))
        extensions = collections.Counter(os.path.splitext(name)[1].lower() or "<none>" for name in asset_entries)
        samples = []
        for name in SAMPLES:
            info = files.get(name)
            samples.append({
                "path": name,
                "exists": info is not None,
                "sizeBytes": info.file_size if info else None,
                "compressedSizeBytes": info.compress_size if info else None,
                "sha256": entry_hash(archive, info) if info else None,
            })
        json.dump({
            "entryCount": len(infos),
            "assetEntryCount": len(asset_entries),
            "assetExtensionCounts": dict(sorted(extensions.items())),
            "assetEntryPaths": asset_entries,
            "samples": samples,
        }, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
