## Task: Add Admin Bootstrap CLI

Implement a secure CLI command that allows a trusted operator to promote an existing user to `ADMIN` after the application is deployed.

### Goal

Add:

```bash
pnpm admin:create
```

The command should:

1. Prompt for the user's email.
2. Find the existing user by email.
3. If the user does not exist, exit cleanly with a clear error.
4. If the user already has the `ADMIN` role, report that no change is needed.
5. If the user has another role, update the existing user's role to `ADMIN`.
6. Print a clear success message.
7. Exit with an appropriate non-zero status code on failure.
8. Never print passwords, password hashes, sessions, tokens, or other sensitive information.

### Important

* **The project already has a role enum. Do NOT create, modify, rename, or duplicate the existing role enum.**
* Inspect the existing Prisma schema and reuse the existing role field and enum.
* Do not introduce another role system.
* Do not create a public HTTP endpoint for admin creation.
* Reuse the project's existing Prisma client/database configuration.
* Do not hardcode database credentials or an admin email.
* Do not edit anything inside `node_modules`.
* Do not modify unrelated application code.
* Follow the existing project architecture and coding conventions.

### CLI Location

Prefer:

```text
scripts/create-admin.ts
```

Add the appropriate package script:

```json
"admin:create": "tsx scripts/create-admin.ts"
```

However, if the project already has an established pattern for CLI/scripts, follow that pattern instead.

### Expected Flow

```text
pnpm admin:create
        ↓
Prompt for email
        ↓
Find user
        ↓
Does user exist?
   ┌────┴────┐
  NO        YES
  ↓          ↓
Error     Check role
             ↓
       Already ADMIN?
        ┌────┴────┐
       YES        NO
        ↓          ↓
     No-op      Set ADMIN
                   ↓
              Success
```

Example:

```text
$ pnpm admin:create

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

User doesn't exist:

```text
No user found with the provided email.
No changes were made.
```

### Security

This is an **operator-only database provisioning command** intended to be run on the deployed server/environment.

Do not add:

* Public admin creation endpoints
* Hardcoded credentials
* Admin passwords
* API keys
* Authentication bypasses

The command should only modify the user's existing role.

### Error Handling

Handle:

* User not found
* Already-admin user
* Database connection failures
* Unexpected database errors
* Invalid/empty email input

Ensure the Prisma/database connection is properly closed when the script exits.

### Testing

Follow the project's existing testing architecture.

Verify at minimum:

* Existing non-admin user can be promoted.
* Existing admin is handled as a no-op.
* Non-existent user fails cleanly.
* Database errors are handled.
* Sensitive information is not logged.

### Documentation

Update the appropriate documentation with:

* Purpose of the admin bootstrap command.
* How to run `pnpm admin:create`.
* When it should be used.
* Security considerations.
* Why admin creation is not exposed as a public API endpoint.

Before implementing, inspect the existing Prisma schema, role enum, User model, package scripts, database configuration, documentation, and testing setup. Reuse existing project patterns and make the smallest appropriate change.

After implementation, run the relevant typecheck, tests, and build checks and report the results.
