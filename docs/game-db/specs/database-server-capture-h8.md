# Database/server capture H8 — extension inventory

H8 inventories only the five allowlisted local HAR files from 2026-08-10. It performs no request and contains no replay path. Raw HAR bytes remain outside Git.

The tracked manifest contains only logical capture IDs and filenames. Output records per-entry method, allowlisted host class, normalized path, status, media types, body byte counts, time, traffic class and names of security-sensitive headers. Header, cookie, query, body and personal values are never emitted. Unknown hosts and paths collapse rather than becoming dynamic output.

Raw-file SHA-256 values exist only transiently to identify exact duplicates; they are not persisted. The output instead pins the manifest digest, a source-identity fingerprint and a recomputed structural digest. Pairwise overlap is a count of structural route keys and is not evidence of complete coverage. A `304` is `not_modified_body_omitted`, always with zero emitted body bytes and never an empty representation. Only non-read methods in an explicit action-family allowlist are labelled mutation; other non-read traffic stays unknown. Mutation observations describe already-captured traffic only and are never executed.

Authority remains structural observation only. No account fact, product fact, authenticated refresh contract, production replacement, Android change, publication or R2 action is authorized.
