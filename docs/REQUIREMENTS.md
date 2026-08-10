# Functional Requirements

The backend provides a complete ecommerce workflow.

## Authentication

The system shall support:

- User registration
- Login
- Logout
- Session management
- Email verification
- Password reset
- Change password
- Authentication middleware
- Authorization middleware

---

## Users

Users can:

- Register
- Login
- Manage profile
- Update personal information
- Manage addresses
- Change password
- View account information

Administrators can:

- View users
- Manage user accounts
- Activate or deactivate users

---

## Product Catalog

The system supports:

- Products
- Product variants
- Categories
- Product images
- Inventory

Each product may contain multiple variants.

Examples:

- Size
- Color
- Storage
- Capacity

Each variant owns:

- SKU
- Price
- Discount
- Stock
- Status

---

## Categories

Categories support:

- Create
- Update
- Delete
- Restore
- List
- Nested hierarchy (if implemented)

---

## Inventory

Inventory tracks stock per product variant.

The system should:

- Increase stock
- Decrease stock
- Prevent overselling
- Support transactional stock updates

Inventory changes must occur inside database transactions.

---

## Shopping Cart

Customers can:

- Create cart
- Add items
- Update quantity
- Remove items
- View cart
- Clear cart

The cart stores product variants rather than products.

---

## Orders

Customers can:

- Checkout
- Place orders
- View order history
- View order details

The system creates immutable order snapshots.

Orders contain:

- customer
- items
- prices
- discounts
- totals
- shipping information
- payment information

---

## Order Items

Each order item stores a snapshot including:

- product name
- variant
- SKU
- quantity
- unit price
- discount
- subtotal

Historical order data must never change when products are edited.

---

## Payments

The payment module records:

- payment status
- payment provider
- payment reference
- amount
- timestamps

Current implementation uses a mock payment provider.

The design should allow future integration with:

- Stripe
- Paymob
- PayPal
- other providers

without changing business logic.

---

## Reviews

Authenticated customers can:

- Write reviews
- Update their reviews
- Delete their reviews

Only verified customers may review purchased products if this feature is enabled.

---

## Administration

Administrators can manage:

- users
- products
- categories
- inventory
- orders
- reviews

Administrative endpoints require authorization.

---

# Security Requirements

The system should implement:

- Session authentication
- Secure cookies
- CSRF protection where appropriate
- Password hashing
- Input validation
- Output sanitization
- Authorization checks
- Rate limiting
- SQL injection protection
- XSS prevention
- Secure HTTP headers

Never expose internal database IDs through the public API.

Public identifiers are used externally.

---

# Out of Scope

The following are intentionally excluded from the initial version:

- Loyalty points
- Recommendations
- Wishlist
- Real payment gateway integration
- Analytics dashboards
- Microservices

These may be added in future iterations.