# Database/server capture H9 — observed schemas

H9 derives value-free request and response schemas from the H8 allowlisted snapshots. Every observation retains only capture ID, entry locator, method, normalized route, status, scope, body disposition, safe field paths/types/states, validator header names and a proved local cache relation when available.

`null`, empty string, empty array, empty object, field absence, body absence, invalid JSON, non-JSON, encoded body, oversized body and `304 not modified` are distinct. Route aggregation records present/absent counts with capture/entry provenance. Static-looking unknown keys remain schema; sensitive or dynamic keys collapse to fixed placeholders. Scalar values never enter output.

ETag and Last-Modified values are compared only in memory. A 304 points to a prior entry only when the exact raw URL and matching validator pair occur in the same capture. Pagination, schedule, availability and ID relationships are schema-field indexes, not semantic claims. Account scope is separated from global product scope and grants no account authority.
