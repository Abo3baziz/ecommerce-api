# T-074 — HTTP/request hardening batch

| Field | Value |
|-------|-------|
| **ID** | T-074 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/http-request-hardening` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Five small verified hardening gaps:

1. `express.json()` has no explicit `limit` (`src/app/index.ts:46`) — implicit ~100kb default, undocumented.
2. No HPP — query-param array pollution reaches validators (`?x=a&x=b`).
3. No compression for large JSON responses.
4. Client-supplied `X-Request-Id` trusted verbatim and persisted (`requestId.ts:5`; typed loosely as possibly `string|string[]`) — log-correlation spoofing.
5. `validate()` assigns `req.query`/`req.params` as `undefined` for body-only schemas (`validate.ts:27-35`) — latent crash for any future middleware touching them.

## Goal

Explicit, bounded, spoof-resistant request handling.

## Scope

- Set explicit body limit; add hpp (if query abuse matters) + compression (if payloads warrant) with rationale notes.
- Validate inbound request-id format/length; generate when absent/invalid.
- Default missing slices to `{}` in validate().

## Acceptance criteria

- [ ] All five addressed; each with a test or documented no-op decision.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
