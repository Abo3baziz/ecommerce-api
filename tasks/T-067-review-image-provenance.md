# T-067 — Review image provenance binding + orphan cleanup

| Field | Value |
|-------|-------|
| **ID** | T-067 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/review-image-provenance` |
| **Depends on** | T-027 (host allowlist) |
| **Blocks** | — |

## Problem

Any http/https URL passes `imageUrlField` and is stored verbatim (`reviews/validators/common.ts:53-75`; service `review.service.ts:159-170, 208-222`). Nothing ties a URL to the uploading user or an upload session: user A can attach any other user's/any product's ImageKit asset. Hard-deleting `review_images` rows leaves CDN assets orphaned forever. (Distinct from T-027's host-allowlist scope.)

## Goal

Users can only attach images they uploaded; deleted review images don't strand CDN objects.

## Scope

- Bind each image URL to owner/upload-session and validate at write time (e.g. upload-path prefix per user, or server-side upload-session token).
- Add orphaned-asset cleanup job (extend T-072's cleanup CLI pattern).

## Acceptance criteria

- [ ] Foreign/other-user assets rejected at write.
- [ ] Cleanup job removes unreferenced review images past retention.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
- Related: ADR-0001 (signed client-side upload trade-offs)
