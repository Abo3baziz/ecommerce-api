# ARCHITECTURE.md

# Architecture

> This document describes the overall architecture of the Ecommerce Backend API. It defines how the system is organized, how requests flow through the application, and the responsibilities of each layer.

---

# Architectural Principles

The project follows:

- Layered Architecture
- Separation of Concerns
- SOLID Principles
- Dependency Injection where appropriate
- Repository Pattern where beneficial
- Service Layer
- Thin Controllers
- Centralized Error Handling
- Consistent API Responses

Business logic should never live inside controllers.

---

# Architecture Style

The application follows a **Layered (N-Tier) Architecture** with clear separation of concerns.

Each layer has a single responsibility and communicates only with adjacent layers.

```
                HTTP Request
                     │
                     ▼
              Express Router
                     │
                     ▼
               Controller Layer
                     │
                     ▼
                Service Layer
                     │
                     ▼
             Repository Layer
                     │
                     ▼
               PostgreSQL Database
```

---

# High-Level Request Flow

```
Client
    │
    ▼
Express Middleware
    │
    ├── Logging
    ├── Rate Limiting
    ├── Session Authentication
    ├── Authorization
    ├── Validation
    ▼
Router
    ▼
Controller
    ▼
Service
    ▼
Repository
    ▼
Database
    ▲
Repository
    ▲
Service
    ▲
Controller
    ▲
HTTP Response
```

---

# Layer Responsibilities

## Router

Responsibilities

- Define endpoints
- Apply middleware
- Forward requests to controllers

Must NOT

- Access the database
- Perform business logic
- Validate business rules

Example

```
POST /api/v1/products
```

---

## Controller

Controllers translate HTTP requests into service calls.

Responsibilities

- Read request data
- Call services
- Return HTTP responses
- Map exceptions to responses

Controllers should remain thin.

Must NOT

- Query the database
- Contain business logic
- Calculate prices
- Manage transactions

---

## Service Layer

The service layer contains all business logic.

Responsibilities

- Business rules
- Validation beyond request shape
- Transactions
- Domain operations
- Coordination between repositories

Examples

- Checkout
- Create order
- Update inventory
- Register user
- Verify email
- Login

Services should be framework-independent whenever possible.

---

## Repository Layer

Repositories abstract database access.

Responsibilities

- CRUD operations
- Database queries
- Pagination
- Filtering
- Joins

Repositories must not contain business logic.

---

## Database

The database is responsible for persistence only.

Responsibilities

- Store data
- Enforce constraints
- Foreign keys
- Indexes
- Transactions
- ACID guarantees

---

# Dependency Direction

Dependencies always flow downward.

```
Router
    │
Controller
    │
Service
    │
Repository
    │
Database
```

Lower layers must never depend on upper layers.

For example:

✅ Service → Repository

❌ Repository → Service

---

# Project Structure

```
src/
│
├── app/
│
├── config/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── products/
│   ├── categories/
│   ├── inventory/
│   ├── cart/
│   ├── orders/
│   ├── payments/
│   └── reviews/
│
├── middleware/
│
├── shared/
│   ├── errors/
│   ├── logger/
│   ├── utils/
│   ├── validation/
│   ├── constants/
│   └── types/
│
├── database/
│
├── routes/
│
├── server.ts
└── index.ts
```

---

# Module Structure

Every feature follows the same structure.

```
products/

├── controller/
├── service/
├── repository/
├── dto/
├── validators/
├── routes/
├── types/
├── mapper/
├── constants/
├── errors/
└── index.ts
```

Optional folders may be omitted when unnecessary.

---

# Middleware Pipeline

Typical request lifecycle

```
Request
    │
    ▼
Request ID
    │
Logging
    │
Helmet
    │
CORS
    │
Cookie Parser
    │
Session
    │
Rate Limiter
    │
Authentication
    │
Authorization
    │
Validation
    │
Route Handler
    │
Controller
    │
Response
```

---

# Session Authentication

Authentication is session-based.

```
Client
   │
   │ Login
   ▼
API
   │
   │ Verify credentials
   ▼
Database
   │
   ▼
Create Session
   │
   ▼
Set Secure Cookie
   │
   ▼
Client
```

Subsequent requests

```
Client
    │
Cookie
    ▼
Session Middleware
    ▼
Session Store
    ▼
Authenticated User
```

---

# Transaction Boundaries

Transactions are started inside the service layer.

```
Controller
     │
     ▼
Order Service
     │
Begin Transaction
     │
├── Create Order
├── Create Order Items
├── Update Inventory
├── Record Payment
│
Commit
```

Repositories should never begin or commit transactions independently.

---

# Error Flow

```
Database Error
      │
Repository
      │
Service
      │
Application Error
      │
Controller
      │
Global Error Handler
      │
HTTP Response
```

# Error Handling

The API should provide:

- consistent error responses
- meaningful validation messages
- proper HTTP status codes

Internal errors must never leak implementation details.

---

# Validation Strategy

Validation occurs in two stages.

## Request Validation

Checks

- Required fields
- Types
- Formats
- Lengths

Occurs before reaching the controller.

---

## Business Validation

Examples

- Product exists
- User owns resource
- Stock available
- Email already used
- Order can be cancelled

Performed in the service layer.

---

# Authorization

Authorization happens after authentication.

Examples

Customer

- Manage own profile
- Create orders
- Manage cart
- Submit reviews

Administrator

- Manage users
- Manage products
- Manage inventory
- Manage categories
- Manage orders

---

# Public ID Resolution

Clients only use public identifiers.

```
Client

GET /products/prd_01JABC123

        │

        ▼

Repository

public_id

        │

        ▼

internal_id

        │

        ▼

Business Logic
```

Internal database IDs are never returned in API responses.

---

# Shared Components

Shared utilities include

- Logger
- Error classes
- Validation helpers
- Pagination helpers
- Constants
- Utility functions
- Response formatter

These components must remain framework-agnostic where practical.

---

# Logging

Every request should produce structured logs including

- Request ID
- Method
- URL
- User ID (if authenticated)
- Response status
- Duration
- Error details

Sensitive information must never be logged.

---

# Configuration

Configuration values come from environment variables.

Examples

- Database URL
- Session secret
- Email provider
- API port
- Cookie settings
- Log level

Configuration should be validated during application startup.

---

# Security Boundaries

The application should enforce

- Session authentication
- Secure cookies
- HTTP-only cookies
- CSRF protection
- Rate limiting
- Input validation
- Output sanitization
- Authorization
- Password hashing

---

# Scalability Considerations

The architecture should support future additions without major refactoring.

Possible future extensions

- Redis caching
- Background jobs
- Search engine
- CDN
- Object storage
- Payment gateways
- Event-driven architecture
- Message queues

The service layer should remain independent enough to support these additions.

---

# Design Principles

The architecture prioritizes

- Maintainability
- Simplicity
- Readability
- Testability
- Extensibility
- Security
- Consistency

Every new feature should integrate into the existing architecture rather than introducing a new architectural style.