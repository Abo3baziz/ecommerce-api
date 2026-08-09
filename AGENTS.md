# AGENTS.md

# Ecommerce Backend API

> This document provides AI agents with the context required to understand the project before making changes. Read this file first.

---

# Project Overview

This project is a production-grade ecommerce backend built as a portfolio-quality system following software engineering best practices rather than tutorial-style architecture.

The system exposes a REST API that powers web, mobile, or third-party clients.

The project focuses on:

- scalability
- maintainability
- security
- clean architecture
- strict TypeScript
- PostgreSQL
- session-based authentication
- high code quality
- well-documented APIs

The backend is API-only and contains no frontend.

---

# Project Goals

The primary goals are:

- Build a realistic ecommerce platform.
- Demonstrate backend architecture suitable for production.
- Follow Domain-Driven thinking where practical.
- Produce maintainable code with clear separation of concerns.
- Favor readability over clever implementations.
- Keep business logic independent from framework details.

---

# Git Workflow

This project follows **GitHub Flow** with short-lived branches.

The `main` branch must always remain stable and deployable.

## Branching Strategy

Never commit directly to `main`.

Create a new branch for **every piece of work**, including features, bug fixes, refactors, documentation updates, testing work, and chores.

Branch naming conventions:

```text
feature/<feature-name>
bugfix/<issue-name>
refactor/<module-name>
docs/<topic>
test/<module>
chore/<task>
hotfix/<issue-name>
```

Examples:

```text
feature/user-registration
feature/product-catalog
bugfix/cart-total-calculation
refactor/user-service
docs/api-authentication
test/order-service
chore/update-dependencies
```

## Working on a Task

For every new task:

1. Ensure `main` is up to date.
2. Create a new branch from the latest `main`.
3. Implement only the requested changes.
4. Keep commits small and focused.
5. Update documentation if necessary.
6. Update `PROJECT_PROGRESS.md` when implementation status changes.
7. Run relevant tests.
8. If the branch contains a **feature**, open a Pull Request when the feature is complete.
9. Do **not** open a Pull Request for non-feature work unless explicitly instructed by the user.
10. Do not merge any branch unless explicitly instructed by the user.
11. After a feature PR is merged, delete the feature branch.
12. After non-feature work is complete, do not create a PR; the branch may be deleted when no longer needed.

## Commit Messages

Follow Conventional Commits.

Examples:

```text
feat(auth): implement session login
feat(products): add product filtering
fix(cart): prevent negative quantity
refactor(users): simplify user service
docs(api): update authentication endpoints
test(orders): add checkout integration tests
chore(deps): update express
```

## Pull Requests

Pull Requests are **only for completed features**.

Each feature Pull Request should:

- Focus on a single feature.
- Include a clear description of the feature and changes.
- Reference related documentation if applicable.
- Update OpenAPI documentation when endpoints change.
- Update `PROJECT_PROGRESS.md` when implementation status changes, but **never open a Pull Request solely for `PROJECT_PROGRESS.md` changes**.
- Ensure relevant tests pass before opening the PR.
- Target the `main` branch.
- Do not merge the Pull Request unless explicitly instructed by the user.
- Delete the feature branch after the Pull Request has been merged.

### Non-Feature Work

Do **not** open Pull Requests for:

- Bug fixes
- Refactors
- Documentation changes
- Testing work
- CI changes
- Chores
- Dependency updates
- `PROJECT_PROGRESS.md` updates

Unless the user explicitly instructs otherwise.

## Testing Branches

Testing work should use dedicated branches.

The initial `feature/tests` branch is reserved for establishing testing infrastructure, configuration, test utilities, and CI testing setup.

Domain-specific testing work should use:

```text
test/<module>
```

Examples:

```text
test/auth
test/users
test/addresses
```

Rules:

- Create each testing branch from the latest `main`.
- Keep testing work isolated in its corresponding branch.
- **Do not open Pull Requests for testing branches.**
- Do not merge testing branches unless explicitly instructed by the user.
- Run all relevant tests and CI checks.
- If additional testing work is needed later, create a new branch from the latest `main`.

## AI Agent Guidelines

When implementing any task:

1. Create a new branch from the latest `main`.
2. Use the appropriate branch prefix for the type of work.
3. Never modify unrelated code.
4. Keep commits logically grouped.
5. Avoid mixing unrelated changes.
6. Do not open a Pull Request unless the work is a completed feature.
7. Never rewrite Git history unless explicitly requested.
8. Do not squash unrelated work into a single commit.
9. Do not merge branches unless explicitly instructed by the user.
10. Delete feature branches after their PR has been merged.

## Definition of Done

A **feature** is considered complete only when:

- Implementation is complete.
- Code follows the project architecture.
- Validation is implemented.
- Error handling is complete.
- Security considerations are addressed.
- Documentation is updated.
- OpenAPI specification is updated if applicable.
- Tests are added or updated.
- `PROJECT_PROGRESS.md` is updated.
- The feature is ready for a Pull Request.

For **non-feature work**, completion means the requested changes are implemented, relevant tests/checks pass, and required documentation is updated. No Pull Request is required.

---
# Project Documentation

The `docs/` directory contains the project's source-of-truth documentation.

Before implementing or modifying any feature, consult the relevant documentation for the affected domain.

## Documentation Index

### Requirements

Defines the functional of the ecommerce system, including supported features, system behavior, security requirements, and project scope.

- `docs/REQUIREMENTS.md`

### Architecture

Defines the overall system architecture, layering, module boundaries, request flow, and design principles.

- `docs/ARCHITECTURE.md`

### API Design

Defines the REST API contract, endpoints, request/response models, status codes, and versioning.

- `docs/API_DESIGN.md`

Do **not** change endpoint behavior unless explicitly requested.

### Database

Defines the database schema, relationships, naming conventions, constraints, and indexing strategy.

- `docs/DATABASE.md`

### Authentication

Defines the authentication and authorization flows, session management, and security requirements.

- `docs/AUTHENTICATION.md`

### Logging

- `docs/LOGGER.md`

The logging document is the source of truth for:
- Logger implementation
- Log formats
- Log destinations
- Log levels
- Request logging
- Error logging
- Pino configuration

Do not change the logging behavior unless explicitly requested.

### Testing

Defines Testing flows, requirements and guidelines

- `docs/TESTING.md`

---

## Documentation Priority

When implementing changes, use the following priority order:

1. User request
2. `AGENTS.md`
3. Relevant document in `docs/`
4. Existing implementation

If documentation and implementation conflict:

- Do **not** guess.
- Preserve existing behavior unless instructed otherwise.
- Report the inconsistency and explain the conflict.

These documents define the source of truth for the project's architecture and API design.

---

# Technology Stack

## Runtime

- Node.js

## Language

- TypeScript (strict mode)

## Framework

- Express.js

## Database

- PostgreSQL

## ORM

Prisma ORM

## Authentication

Session-based authentication

## API

REST

## API Documentation

OpenAPI Specification

## Validation

Centralized request validation

## Logging

Structured logging

## Testing

Unit tests
Integration tests

---

# General Requirements

Every implementation should prioritize:

- readability
- maintainability
- consistency
- security
- testability

Avoid:

- duplicated logic
- large controllers
- business logic inside routes
- magic strings
- magic numbers

---

# Public vs Private IDs

Entities contain two identifiers.

Internal ID

- Database primary key
- Never exposed

Public ID

- Used in APIs
- Stable
- Safe to expose

Business logic translates public IDs to internal IDs.

---

# Transactions

Database transactions are required for operations including:

- checkout
- order creation
- inventory updates
- stock reservation
- payment completion

Transactions should preserve consistency under concurrent access.

---

# Error Handling

The API should provide:

- consistent error responses
- meaningful validation messages
- proper HTTP status codes

Internal errors must never leak implementation details.

---

# Coding Standards

All code should:

- use strict TypeScript
- avoid `any`
- prefer explicit types
- use async/await
- avoid deeply nested logic
- keep functions focused
- use descriptive names

---

# AI Agent Guidelines

When modifying the project:

1. Preserve existing architecture.
2. Do not bypass service layers.
3. Keep controllers thin.
4. Prefer reusable abstractions.
5. Maintain consistent naming.
6. Follow REST conventions.
7. Do not introduce breaking API changes unless requested.
8. Keep security in mind.
9. Write code that is easy to review.
10. If uncertain, prefer consistency with the existing codebase.

## Node Modules Integrity

- Never directly edit, modify, or delete files inside `node_modules/`.
- Treat `node_modules/` as generated dependency files managed by the package manager.
- Never rely on manual changes inside `node_modules/` for implementation, testing, or debugging.
- If a dependency needs to be modified, use the package manager's supported patch mechanism or make the appropriate change to `package.json` and the lockfile.
- Do not commit or attempt to commit `node_modules/`.
- Ensure all required changes are reproducible from the repository after a clean dependency installation.

## Do Not Do 
Never:

- Skip validation
- Access Prisma directly from controllers
- Mix business logic with HTTP concerns
- Expose internal IDs
- Duplicate repository queries
- Ignore TypeScript errors
- Disable strict mode
- Use any unless explicitly justified
- Swallow errors

For every task in this project, finish your response with a project progress summary.

Use this template:

# Project Progress Tracking

For every task in this project:

1. Update `PROJECT_PROGRESS.md` to reflect the current implementation status.
2. Only record work completed during the current response.
3. Do not mark tasks as completed unless they have been fully implemented and verified.
4. If architectural or design decisions are made, record them under **Decisions**.
5. Keep updates concise and avoid repeating unchanged information.

Use the following template:

```md
## Project Progress

### Completed
- ...

### Deliverables
- ...

### Decisions
- ...

### Pending
- ...

### Next Step
- ...
```

The summary should:
- Include only changes made during the current response.
- Be concise (5–10 bullet points total).
- Reflect the current project state accurately.
- Avoid duplicating information already present in `PROJECT_PROGRESS.md`.