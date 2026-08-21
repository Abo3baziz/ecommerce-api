# T-034 — Logger architecture: O(n²) rewrite, rotation, token redaction

| Field | Value |
|-------|-------|
| **ID** | T-034 |
| **Priority** | P1 |
| **Status** | todo |
| **Type** | `refactor` |
| **Branch** | `refactor/logger-sink-redaction` |
| **Depends on** | — |
| **Blocks** | T-053 (flush-on-shutdown depends on sink design) |

## Problem

Two compounding defects in `src/shared/logger/index.ts`:

1. **O(n²) I/O:** every entry re-reads, JSON.parses, inserts into, and rewrites the entire pretty-printed `logs/log.json` (lines 102-138). No size cap, rotation, or retention; non-atomic write risks corruption; unsafe multi-instance.
2. **Secret leakage:** request middleware logs `url: req.originalUrl` (`src/app/index.ts:25`) which includes query strings — email links embed `?token=<raw opaque token>` (verification/email-change/password-reset), so live credentials sit plaintext in never-rotated logs. Contradicts `docs/LOGGER.md` ("Do not log tokens").

## Goal

Bounded, append-only logging that never persists raw tokens.

## Scope

- Switch file sink to append-only NDJSON (raw entries); keep the categorized `log.json` as a derived/export artifact if LOGGER.md requires it — else update LOGGER.md explicitly (docs change needs user sign-off).
- Add size-based rotation + retention policy.
- Log `pathname` only (strip/redact query string) in request middleware; add a redact list (token, otp, password).
- Keep the public logger API unchanged.

## Acceptance criteria

- [ ] Logging is O(1) per entry; rotation verified.
- [ ] No raw token appears in any log output (regression test greps log output for seeded token).
- [ ] LOGGER.md matches implementation.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
- `docs/LOGGER.md`
