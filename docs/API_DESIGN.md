# API Design

> This document is the entry point for the Ecommerce Backend API design.

---

# Purpose

This document defines the global API conventions used throughout the project.

Detailed endpoint specifications are organized by resource under `docs/api/`.

---

# API Design Principles

The API should:

- follow REST conventions
- use resource-based endpoints
- support pagination
- support filtering
- support sorting
- support searching where appropriate
- version endpoints
- RESTful resource design
- Consistent response format
- Public identifiers
- Error handling

Example:
/api/v1/products

---

# Resource Documentation

## Authentication

- docs/api/authentication/registration.md
- docs/api/authentication/login.md
- docs/api/authentication/session-management.md
- docs/api/authentication/email-verification.md
- docs/api/authentication/password-reset.md

## Users

- docs/api/users/users.md
- docs/api/users/addresses.md
- docs/api/users/change-email.md
- docs/api/users/change-phone.md
- docs/api/users/change-password.md

## Administration

- docs/api/admin/admin.md