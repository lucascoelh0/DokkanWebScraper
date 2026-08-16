# Summon RNG audit S3 observational contract

Status: implemented infrastructure; no real observations are included. The contract is offline, default-off and independent from Android, R2, publishers and production data.

## Unit of observation

Each row is one displayed card slot. Rows sharing `anonymousSessionId` and `multiId` form one single or multi-summon. This preserves slot-specific guarantees and prevents a later model from treating a whole multi as identically distributed when its guaranteed slot differs.

The contract retains only:

- a freshly generated dataset/session/sequence/multi/observation ID;
- an hourly UTC `temporalBucket`, game build and region;
- exact banner ID/version and validity window;
- summon type, slot index, card ID, rarity and featured/guaranteed flags when known;
- Friend sequence, attempt index, trigger flag, attempts until trigger and coarse Friend-to-normal interval when applicable;
- a closed observation-origin and quality classification.

It does not accept an exact timestamp field, free-form notes, real account/player/user IDs, credentials, tokens, cookies, device/advertising IDs, raw authenticated payloads, or reversible hashes derived from them. The contract supplies `generateS3Id`, which creates namespaced IDs with Node's cryptographic RNG; collectors should use it for every dataset/session/sequence/multi/observation/evidence ID. The schema can validate an imported ID's namespace and shape but cannot prove how it was created, so imported data must enforce this boundary and the validator never treats ID format as proof of anonymization.

## Completeness and stopping rules

For each Friend sequence, attempt indices must start at 1 and be contiguous. Each index identifies exactly one single/multi invocation, buckets cannot move backward between attempts, and banner version/summon type remain fixed across the sequence. A trigger may occur in at most one attempt, must be the final Friend attempt, and records before it are retained as negative attempts. A normal banner result linked to a Friend sequence is rejected unless that trigger exists in the same anonymous session. Every row of one multi must agree on time, banner, summon type, provenance, Friend linkage and interval; slot indices must be unique and contiguous.

The trigger definition can remain `pending` in an empty template. As soon as a record asserts a Friend trigger or links a normal summon to it, the definition must be `fixed`, observable, written before collection and bounded to 500 characters. This prevents selecting a trigger retrospectively because it happened to precede a memorable result.

## Provenance and analysis eligibility

Origins are closed to manual screen recording, screenshot transcription, sanitized local history or a consented sanitized contribution. Quality is one of:

- `complete_verified`: every relevant slot/attempt is retained and the transcription has a verifiable source;
- `complete_unverified`: claimed complete, but without independent source verification;
- `partial_exploratory`: gaps or selective retention are known or cannot be excluded.

Evidence descriptors bind trigger preregistration, official rules and observation sources by role, SHA-256, byte size and media type. These descriptors remain declarations until their external bytes are independently verified; raw evidence remains outside Git. `analysisCandidateObservationCount` therefore means only that the row is structurally complete and bound to role-correct descriptors. It is not a confirmatory-evidence count. A Friend-linked normal observation additionally requires the pre-fixed trigger, an observed triggering sequence, nondecreasing hourly buckets and an interval possible within those buckets. S4 must still implement the correct banner-, step- and slot-specific null model, and S5 must verify source material, preregistration timing and multiplicity correction before any confirmatory claim.

## Banner identity

A banner version is keyed by `(region, bannerId, bannerVersion)`, has an hourly validity window and records whether its official rule/rate snapshot is missing or pinned by SHA-256. S3 can safely retain observations while a snapshot is missing, but those rows remain exploratory. The snapshot bytes themselves are an external, sanitized first-party artifact and are not embedded in observation rows.

## Local validation

After compiling, validate a sanitized JSON dataset with:

```powershell
npm run audit:summon-rng-s3 -- --dataset D:\path\to\sanitized-observations.json
```

The runner accepts one regular JSON file up to 16 MiB, rejects malformed UTF-8 and prints only aggregate structural counts. It does not verify the external evidence bytes, issue a network request or write data.
