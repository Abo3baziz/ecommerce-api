# Operations

> This document describes operator-facing tooling and maintenance procedures for the Ecommerce Backend API.

---

# Admin Bootstrap CLI

## Purpose

The Admin Bootstrap CLI promotes an existing user to an administrator role (`SUPER_ADMIN` or `ADMIN`). It exists because there is no public HTTP endpoint for admin creation: only a trusted operator running the command on the deployed server/environment can grant admin privileges. This keeps privilege escalation impossible from the public API surface.

The **first user promoted** becomes the `SUPER_ADMIN`; every later promotion creates a regular `ADMIN`. The `SUPER_ADMIN` is the only role that can change other users' roles via the API.

The command only changes the user's role. It never creates accounts, never assigns passwords, and never touches sessions or tokens.

## How to Run

The project uses npm as its package manager:

```bash
npm run admin:create
```

The script lives at `scripts/create-admin.ts` and is executed with `tsx`:

```bash
tsx scripts/create-admin.ts
```

## When to Use

Use this command to promote an existing registered user to an administrator role, typically:

- Immediately after initial deployment — the first promotion bootstraps the `SUPER_ADMIN`.
- When a new administrator is onboarded (becomes `ADMIN` once a `SUPER_ADMIN` exists).
- When restoring an admin who was demoted.

The user must already exist and be registered. The command cannot create users.

## Behavior

1. Prompts for the user's email.
2. Looks up the user by email.
3. If the user does not exist, prints an error and exits with a non-zero status.
4. If the user is already `SUPER_ADMIN`, reports that no change is needed and exits successfully.
5. If the user is already `ADMIN`, reports that no change is needed and exits successfully.
6. Otherwise (a `CUSTOMER`):
   - If **no** `SUPER_ADMIN` exists, promotes the user to `SUPER_ADMIN` (first-promotion rule).
   - If a `SUPER_ADMIN` already exists, promotes the user to `ADMIN`.

### Examples

First promotion (bootstraps the super admin):

```text
$ npm run admin:create

Admin email: admin@example.com

User found.
Current role: CUSTOMER

No SUPER_ADMIN exists yet.
Promoting user to SUPER_ADMIN...

User successfully promoted to SUPER_ADMIN.
```

Subsequent promotion:

```text
$ npm run admin:create

Admin email: staff@example.com

User found.
Current role: CUSTOMER

Promoting user to ADMIN...

User successfully promoted to ADMIN.
```

Already a super admin:

```text
User is already a SUPER_ADMIN.
No changes were made.
```

Already an admin:

```text
User is already an ADMIN.
No changes were made.
```

User does not exist:

```text
No user found with the provided email.
No changes were made.
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | User promoted, or already a `SUPER_ADMIN`/`ADMIN` (no change needed) |
| `1`  | User not found, invalid input, or an unexpected/database error |

## Security Considerations

- The command is **operator-only** and must be run on the deployed server/environment, not exposed to clients.
- No public admin-creation endpoint exists by design; the API surface offers no way to escalate a user to `ADMIN` or `SUPER_ADMIN` — the `SUPER_ADMIN` role is only granted by this CLI, and the role endpoint only accepts `CUSTOMER`/`ADMIN`.
- There is **exactly one** `SUPER_ADMIN` and it can never be demoted via the API. If the super admin account is lost or compromised, recovery requires manual database intervention (update the `role` column of another user to `SUPER_ADMIN` out-of-band).
- The command reuses the project's existing Prisma client and database configuration — no credentials are hardcoded, and the operator is never prompted for passwords or secrets.
- Sensitive data (password hashes, sessions, tokens, credentials) is never printed. Only the user's role is read and reported.
- Errors are logged through the shared logger without leaking implementation details to the terminal.

## Why No Public Endpoint

Admin creation is intentionally not exposed as a REST endpoint:

- Granting `ADMIN` requires trust in the caller; a public endpoint would rely on the `ADMIN` role itself to authorize, which cannot bootstrap the first admin.
- Operator-only, out-of-band provisioning avoids credential/privilege escalation through the public API.
- It matches the documented authorization model where role changes are managed operationally, not via the API.
