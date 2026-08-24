# T-011 — Generate OpenAPI 3.1 from `docs/api/**`

| Field | Value |
|-------|-------|
| **ID** | T-011 |
| **Priority** | P2 |
| **Status** | in_progress |
| **Type** | `docs` / `chore` |
| **Branch** | `docs/openapi-spec` |
| **Depends on** | — |
| **Blocks** | One-click Apidog import |

## Problem

API contract lives in markdown under `docs/api/**`. Apidog setup is manual. An OpenAPI 3.1 artifact would make import one-click and help client generation.

## Goal

Produce and maintain an OpenAPI 3.1 specification covering implemented endpoints.

## Scope

- Choose approach: hand-maintained YAML, generated from Zod/routers, or compiled from markdown.
- Cover auth, users, addresses, catalog, cart, orders, reviews, admin.
- Publish path e.g. `docs/openapi.yaml` or `openapi/openapi.yaml`.
- CI check that spec validates (optional but recommended).
- Update `docs/APIDOG_TESTING.md` Import section.
- Keep markdown docs as source of truth **or** reverse that decision — document which wins.

## Acceptance criteria

- [ ] Valid OpenAPI 3.1 file in repo.
- [ ] Apidog can import it.
- [ ] Documented maintenance process.
- [ ] Major implemented endpoints represented.

## References

- `docs/APIDOG_TESTING.md` — OpenAPI follow-up
- `docs/API_DESIGN.md`

## Progress

- **Phase 1 (2026-08-24):** `openapi/openapi.yaml` scaffold — valid OpenAPI 3.1 (redocly lint clean), complete Auth module (13 paths), shared envelope/pagination/error components, maintenance process documented in `openapi/README.md` (markdown contracts remain source of truth).
- **Remaining:** users, addresses, catalog, cart, orders, reviews, admin modules; optional CI lint step; APIDOG import note.
