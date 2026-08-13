# Game DB First-Party Acquisition Playbook

## Purpose

This document turns the current research into a concrete staged path for fully independent Dokkan Global DB updates.

The important distinction is:

- the data pipeline is already working from a readable SQLite DB
- the remaining work is acquisition automation

## Current state

We can already do all of this ourselves once we have a readable `database.db`:

1. export the required tables
2. normalize them into the first-party export contract
3. build the Dokkanpanion dataset
4. validate
5. publish

Today, the remaining gap is specifically:

- how to obtain the latest DB artifact ourselves
- how to decrypt it when the downloaded artifact is not plain SQLite

## Historical interception clues

We now have multiple historical/community clues pointing in the same direction:

- older bot repos show OAuth2-style MAC authentication against Dokkan game endpoints
- `tanukijs/dokkan-bot` shows a direct `GET /client_assets/database` flow
- UniDokkan/KX-era docs describe proxy/certificate-based tooling around live game traffic
- an old community report described successful HTTPS interception with Charles Proxy after installing a custom SSL certificate on-device

Important caution:

- this is useful architecture evidence
- it is not proof that the exact same traffic shape still works unchanged today

So we should treat it as a strong research clue, not as a guaranteed implementation recipe.

### Historical report summary

The reported setup was:

1. run Charles Proxy on a local machine
2. install the Charles SSL certificate on the mobile device
3. route device traffic through the proxy
4. inspect the decrypted HTTPS requests during startup/login

The reported findings were:

- the Global client appeared to download the database on every startup
- many banner/startup resources were repeatedly requested
- the traffic was described as server/API driven
- access was said to use OAuth2 plus MAC token authentication

Even if some specifics are outdated, this is still useful because it suggests:

- startup/login traffic inspection is a realistic way to rediscover the modern acquisition flow
- the database endpoint may be observable without needing full gameplay automation
- a proxy/MITM workflow is likely one of the best ways to validate our assumptions before writing a full client

### What this changes in practice

This clue strengthens the case for a staged acquisition spike:

1. capture startup/login traffic with a trusted proxy
2. identify the modern database-related requests and headers
3. confirm whether `/client_assets/database` still appears directly or indirectly
4. record the exact request prerequisites:
   - auth context
   - MAC headers
   - client version
   - asset/database version headers
5. reproduce only the DB acquisition call first

### External notes worth keeping, but not trusting blindly

We also found community notes claiming the following:

- Dokkan API traffic may require SSL-pinning bypass on emulator/rooted device
- Frida may be useful for forcing trust of a proxy CA
- some request bodies may still be encrypted after HTTPS interception
- SQLite assets are SQLCipher-backed
- keys, IVs, or session secrets may be derived during the auth/sign-in flow
- values may be recoverable from native libraries such as `libil2cpp.so`

These notes should not all be treated as established fact yet.

What is already reasonably corroborated by repos we inspected:

- older bots definitely implement MAC-style request signing
- older bot code does use AES-CBC for at least some signed payload handling
- `tanukijs/dokkan-bot` strongly suggests a live `/client_assets/database` refresh path
- Dokkan database decryption via SQLCipher-compatible tooling is consistent with `bensnilloc/...Database-Decryptor`
- Nicholas' workflow proves that an automated Global DB refresh pipeline exists in practice, even if the critical downloader step is closed-source

What is still unverified in our research and should be tested before we depend on it:

- that current Dokkan traffic still needs Frida-based SSL-pinning bypass in our emulator setup
- that all useful API payloads remain application-encrypted after HTTPS MITM
- the exact cipher modes/key derivation used by the current client
- whether `libil2cpp.so` is the right place to recover modern secrets
- specific local encrypted filenames such as `dataenc_glb.db` / `dataenc_jp.db`
- any claimed current "static master key" string unless we verify it against a real current DB artifact

Practical rule:

- use these notes as hypotheses to guide experiments
- do not hard-code architecture decisions around them until we confirm them from live traffic, a current APK, or a successfully decrypted current DB artifact

### Emulator experiment: 2026-06-27/28 findings

We also ran an actual Android Studio emulator experiment on Windows with HTTP Toolkit:

- a `Google APIs` emulator image was required so `adb root` would work
- HTTP Toolkit could see attempted Dokkan connections to `ishin-global.aktsk.com`
- full HTTPS interception still did not succeed cleanly
- the app produced aborted/reset TLS connections before any HTTP request was visible

What this most likely means:

- either current Dokkan still has extra trust/pinning behavior beyond basic user-CA trust
- or HTTP Toolkit's system-CA injection did not fully neutralize the app's TLS validation path

Either way, we should treat full live MITM as currently unproven, not as the main dependency for the project.

However, the rooted emulator gave us another important path:

- package confirmed: `com.bandainamcogames.dbzdokkanww`
- local app storage contains multiple DB-like files
- notably: `/data/data/com.bandainamcogames.dbzdokkanww/files/backup/database.db`
- we now have a local helper to pull that file repeatably:
  - `npm run run:game-db-pull-emulator-database-artifact -- --device-serial "emulator-5554"`

Observed properties of that file:

- pulled into the workspace at:
  - `data/game-db-acquisition/downloads/emulator-backup-latest/database.db`
- size at inspection time: `535,552 bytes`
- first bytes were not `SQLite format 3`
- observed header hex: `8fd0d172884ed744d087f0f1b20bbcfb`
- so the file appears encrypted or otherwise packaged, not directly readable SQLite

This is a strong signal that local-device artifact inspection may be as important as network interception for the next stage.

Follow-up decrypt result:

- a local Windows venv with `sqlcipher3` successfully decrypted this artifact
- the `GlbDbPassword` value from Nicholas' `settings.json` worked as a text key with `cipher_compatibility = 3`
- the decrypted output is valid SQLite
- however, it only exposed about `137` tables and did **not** include expected full-data tables such as `active_skill_sets`

So the current emulator backup artifact is real and decryptable, but it does not yet look like the full production game DB snapshot used by the broader pipeline.

We later confirmed a much more important on-device artifact:

- path: `/data/data/com.bandainamcogames.dbzdokkanww/files/assets/sqlite/current/en/database.db`
- local prefs confirm `AssetDbVersion = 1782367825`
- pulled size at inspection time: `96,518,144 bytes` (about `92 MB`)
- header hex: `1a17d99f17446c7a78670bd3251a209f`

This path closely matches the SQLite asset layout seen in Nicholas' repo (`.../sqlite/current/en/database.db`) and is almost certainly the real primary Global DB artifact we want.

Current status of that artifact:

- it is not plain SQLite
- direct SQLCipher opening with `cipher_compatibility = 3` failed
- old `pysqlsimplecipher` unwrap using both historical and current candidate keys also failed
- direct SQLCipher opening with the known `GlbDbPassword` worked with default/`cipher_compatibility = 4`
- exporting that decrypted DB produced a valid SQLite with `230` tables
- the resulting SQLite successfully powered `run:game-db-build-first-party-export`
- the resulting export successfully powered `run:game-db-update --dry-run`

So the project is now materially closer to independence:

- we can locate and pull the real on-device DB artifact ourselves
- we have the exact version number the client believes it has
- we have a working decrypt path for this full asset DB in the rooted-emulator workflow
- the remaining long-term challenge is making acquisition work in environments where we cannot simply root and pull the app sandbox

### HTTP Toolkit Frida repo note

We also reviewed the public `httptoolkit/frida-interception-and-unpinning` repo as a possible interception aid.

Useful signals from the repo/docs:

- it is explicitly designed for mobile HTTPS MitM interception with Frida
- it claims to handle proxy redirection, CA injection, pinning/transparency bypasses, some root-detection bypasses, and HTTP/3 blocking/fallback
- the Android docs position it as a general-purpose helper for apps that reject interception certificates

Important caveat:

- the same docs also explicitly say this will not work for every app
- some apps use custom trust/pinning/TLS behavior that generic scripts do not cover

Practical project stance:

- treat this as an experimental research path for discovering live Dokkan request flows
- do not make project progress depend on Frida interception succeeding
- keep the rooted-emulator artifact path as the more reliable fallback, since it is already producing decryptable local DB artifacts

## Manual AQ0–AQ6 flow

The detailed contract is
[`specs/game-db-manual-sqlite-acquisition-aq0-aq6.md`](specs/game-db-manual-sqlite-acquisition-aq0-aq6.md).
The downloader is offline by default and no longer accepts a direct URL,
arbitrary output directory or output filename.

### 1. Save the descriptor externally

The user saves only the response body of `/client_assets/database` in an
external local file. Do not save or copy a HAR, request headers, Authorization,
cookies, tokens, account data or query values into this repository.

### 2. Validate the descriptor offline

```powershell
npm run run:game-db-download-database-artifact -- --descriptor-json "C:\external\client-assets-database.json" --dry-run
```

This validates the exact Global EN descriptor schema, version binding and
official HTTPS CDN path. It performs no request and persists no URL or descriptor
body. `--database-url` and the former `--client-assets-json` path are disabled.

### 3. Validate an already downloaded artifact offline

```powershell
npm run run:game-db-download-database-artifact -- --artifact-path "C:\external\database.db" --descriptor-json "C:\external\client-assets-database.json"
```

This streams the local file, enforces the hard size ceiling, calculates local
SHA-256 and reports `readable_sqlite` or `encrypted_or_packaged` together with
sanitized descriptor lineage. An artifact without `--descriptor-json` fails
closed. This offline validation does not promote the file into the immutable
store.

### 4. Future separately authorized official GET

Do not run this command during AQ0–AQ6. After independent review and a separate
explicit authorization for one official download, the command is:

```powershell
npm run run:game-db-download-database-artifact -- --descriptor-json "C:\external\client-assets-database.json" --authorize-download
```

The implementation issues one redirect-disabled HTTPS GET to the exact validated
URL, streams into a same-filesystem temporary, validates `Content-Length`, byte
count and local SHA-256, then commits an immutable content-addressed artifact and
promotes `latest.json` atomically. The previous identity remains in the pointer
and all prior artifact directories are retained. No descriptor endpoint, login
or refresh request is implemented.

### 5. Decrypt locally only when necessary

This is a separate decision and is NO-GO during AQ0–AQ6. For an
`encrypted_or_packaged` artifact, use the existing SQLCipher helper only after
separate authorization and keep the key outside Git/logs:

```powershell
.\.venv-sqlcipher\Scripts\python game-db\game-db-decrypt-sqlcipher.py --input-path "<immutable-artifact-path>" --output-path "<local-decrypted-sqlite-path>" --key "<local-key>" --cipher-compatibility 4
```

The acquisition metadata never contains the key or the decrypted output path.

### 6. Validate the SQLite read-only and compare C4

```powershell
npm run run:game-db-sqlite-compatibility -- --sqlite-path "C:\local\decrypted-database.sqlite" --output-file ".\game-db\data\game-db-acquisition\compatibility.json"
```

The result is `exact_profile_match`,
`schema_compatible_but_evidence_refresh_required`, `incompatible` or `unknown`.
It never authorizes native evidence reuse. A changed SQLite must refresh bounded
ELF/DB48/DB49/DB50 evidence and receive a reviewed C4 baseline before C1–C3.
Even an exact SQLite match still requires C4 with the exact pinned ELF and
semantic artifacts. Never run DB0–DB50 cumulatively for this refresh.

### 7. Build only a shadow first-party export

Only after the prior local gates are separately authorized:

```powershell
npm run run:game-db-build-first-party-export -- --sqlite-path "C:\local\decrypted-database.sqlite" --settings-json "C:\external\settings.json"
npm run run:game-db-update -- --acquisition-mode first-party-export --first-party-dir ".\game-db\data\game-db-acquisition\first-party\latest" --skip-publish
```

Stop after the local comparison. Do not publish, promote production data or
change Android.

## Independent decisions and current readiness

| Decision | Status after AQ0–AQ6 |
| --- | --- |
| merge manual/default-off infrastructure | GO after independent review |
| offline descriptor validation | GO |
| offline artifact validation | GO |
| official database GET | NO-GO pending review and separate authorization |
| local SQLCipher decryption | NO-GO in this campaign |
| focused shadow refresh | NO-GO in this campaign |
| authenticated refresh or credential acquisition | NO-GO |
| R2 publication or productive promotion | NO-GO |
| Android | NO-GO |

The immediate next gate is independent review. Full acquisition automation,
authenticated refresh, publication, production promotion and Android remain
outside this playbook slice.

