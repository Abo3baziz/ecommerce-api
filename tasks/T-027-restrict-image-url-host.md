# T-027 — Restrict `image_url` to ImageKit host

| Field | Value |
|-------|-------|
| **ID** | T-027 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` / hardening |
| **Branch** | `bugfix/image-url-host-allowlist` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`imageUrlField` accepts any absolute http/https URL. Product/variant images can point at arbitrary hosts, weakening the ImageKit-centric upload design.

## Goal

Optionally allowlist `image_url` to the configured ImageKit `urlEndpoint` host (with escape hatch for existing data if needed).

## Scope

- Validator change + env-based allowed hosts.
- Migration/note for existing non-ImageKit URLs.
- Tests for reject/allow.
- Docs.

## Acceptance criteria

- [ ] Non-allowlisted hosts rejected on write (if feature enabled).
- [ ] Documented config flag/default.
- [ ] Tests green.

## References

- `PROJECT_PROGRESS.md` — ImageKit decisions
- `src/shared/validation` image URL field
