# Operations

> This document describes operator-facing tooling and maintenance procedures for the Ecommerce Backend API.

---

# Admin Bootstrap CLI

## Purpose

The Admin Bootstrap CLI promotes an existing user to the `ADMIN` role. It exists because there is no public HTTP endpoint for admin creation: only a trusted operator running the command on the deployed server/environment can grant admin privileges. This keeps privilege escalation impossible from the public API surface.

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

Use this command to promote an existing registered user to `ADMIN`, typically:

- Immediately after initial deployment (first admin account).
- When a new administrator is onboarded.
- When restoring an admin who was demoted.

The user must already exist and be registered. The command cannot create users.

## Behavior

1. Prompts for the user's email.
2. Looks up the user by email.
3. If the user does not exist, prints an error and exits with a non-zero status.
4. If the user is already `ADMIN`, reports that no change is needed and exits successfully.
5. Otherwise, updates the user's role to `ADMIN` and prints a success message.

### Examples

Promotion:

```text
$ npm run admin:create

Admin email: admin@example.com

User found.
Current role: CUSTOMER

Promoting user to ADMIN...

User successfully promoted to ADMIN.
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
| `0`  | User promoted, or already an `ADMIN` (no change needed) |
| `1`  | User not found, invalid input, or an unexpected/database error |

## Security Considerations

- The command is **operator-only** and must be run on the deployed server/environment, not exposed to clients.
- No public admin-creation endpoint exists by design; the API surface offers no way to escalate a user to `ADMIN`.
- The command reuses the project's existing Prisma client and database configuration — no credentials are hardcoded, and the operator is never prompted for passwords or secrets.
- Sensitive data (password hashes, sessions, tokens, credentials) is never printed. Only the user's role is read and reported.
- Errors are logged through the shared logger without leaking implementation details to the terminal.

## Why No Public Endpoint

Admin creation is intentionally not exposed as a REST endpoint:

- Granting `ADMIN` requires trust in the caller; a public endpoint would rely on the `ADMIN` role itself to authorize, which cannot bootstrap the first admin.
- Operator-only, out-of-band provisioning avoids credential/privilege escalation through the public API.
- It matches the documented authorization model where role changes are managed operationally, not via the API.
