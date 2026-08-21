# Unit Super Attack release contract

Unit Super Attacks are release-scoped data. The legacy `unitSuperAttacks` field
remains the base/initial list for compatibility with old character payloads.
New payloads may provide `ezaUnitSuperAttacks` for the EZA list.

Team Analysis selects `unitSuperAttacks` for `initial` and
`ezaUnitSuperAttacks` for both `eza` and `seza`. The source currently does not
provide a distinct SEZA Unit Super Attack state, so SEZA inherits only the EZA
list. It must never fall back from EZA/SEZA to the base list, because that would
display attacks from the wrong release.

The lists are populated from structured FYI attack state/level data. Regex is
not used to decide release ownership.
