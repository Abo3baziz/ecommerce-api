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

This project follows **GitHub Flow** with short-lived feature branches.

The `main` branch must always remain stable and deployable.

## Branching Strategy

Never commit directly to `main`.

Create a new branch for every feature, bug fix, refactor, documentation update, or chore.

Branch naming conventions:

```
feature/<feature-name>
bugfix/<issue-name>
refactor/<module-name>
docs/<topic>
test/<module>
chore/<task>
hotfix/<issue-name>
```

Examples:

```
feature/user-registration
feature/product-catalog
feature/session-authentication
bugfix/cart-total-calculation
refactor/user-service
docs/api-authentication
test/order-service
chore/update-dependencies
```

## Working on a Feature

For every new task:

1. Ensure `main` is up to date.
2. Create a new branch from `main`.
3. Implement the requested changes.
4. Keep commits small and focused.
5. Update documentation if necessary.
6. Update `PROJECT_PROGRESS.md`.
7. Run relevant tests.
8. Open a Pull Request.
9. Merge into `main` only after review or verification.
10.Do Not Delete the feature branch after merging (For Reference).

## Commit Messages

Follow Conventional Commits.

Examples:

```
feat(auth): implement session login
feat(products): add product filtering
fix(cart): prevent negative quantity
refactor(users): simplify user service
docs(api): update authentication endpoints
test(orders): add checkout integration tests
chore(deps): update express
```

## Pull Requests

Each Pull Request should:

- Focus on a single feature or concern.
- Include a clear description of the changes.
- Reference related documentation if applicable.
- Update OpenAPI documentation when endpoints change.
- Update `PROJECT_PROGRESS.md` if implementation status changes.
- Ensure tests pass before merging.

## Testing Branches

Testing work should use dedicated feature branches when tests are added independently from the feature implementation.

Use the following naming convention:

```text
feature/tests-auth
feature/tests-users
feature/tests-addresses
```

### Rules

* Create each testing branch from the latest `main`.
* Use `feature/tests-<domain>` where `<domain>` identifies the resource or module being tested.
* Keep tests for a specific domain isolated in its corresponding branch.
* Open a Pull Request from the testing branch into `main`.
* Run all required CI checks before merging.
* Review the changes before merging.
* After the PR is merged, delete the testing branch.
* Do not continue adding unrelated tests to an already-merged testing branch.
* If additional tests are needed later, create a new branch from the latest `main`.

### Examples

```text
feature/tests-auth
    → tests authentication
    → PR
    → main

feature/tests-users
    → tests users
    → PR
    → main

feature/tests-addresses
    → tests addresses
    → PR
    → main
```

The initial `feature/tests` branch should be reserved for establishing the testing infrastructure, configuration, test utilities, and CI testing setup. Domain-specific tests should use dedicated `feature/tests-<domain>` branches.

## AI Agent Guidelines

When implementing a new feature:

1. Assume work is being done on a feature branch unless instructed otherwise.
2. Never modify unrelated code.
3. Keep commits logically grouped.
4. Avoid mixing refactoring with feature implementation.
5. Preserve a clean Git history.
6. Recommend creating separate Pull Requests for unrelated changes.
7. Never rewrite Git history unless explicitly requested.
8. Do not squash unrelated work into a single commit.

## Definition of Done

A feature is considered complete only when:

- Implementation is complete.
- Code follows the project architecture.
- Validation is implemented.
- Error handling is complete.
- Security considerations are addressed.
- Documentation is updated.
- OpenAPI specification is updated (if applicable).
- Tests are added or updated.
- `PROJECT_PROGRESS.md` is updated.
- The feature is ready to merge into `main`.

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