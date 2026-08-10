# Database Schema

**Project:** E-Commerce Backend API

**Database:** PostgreSQL

**Version:** 1.0

---

# Overview

This document defines the physical database schema for the E-Commerce Backend.

The database is normalized to reduce redundancy while maintaining query performance. Each table belongs to a business domain and defines its columns, constraints, indexes, and relationships.

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

# Naming Conventions

## Tables

- Use `snake_case`
- Use plural nouns

Examples

```
users
product_variants
order_items
coupon_usages
```

---

## Columns

- Use `snake_case`
- Use descriptive names

Examples

```
created_at
updated_at
deleted_at
public_id
```

Foreign key columns reference the primary key of the referenced table and follow:

```
<referenced_table>_id
```

Examples

```
users_id
products_id
product_variants_id
orders_id
categories_id
coupons_id
```

---

## Primary Keys

Every table uses an auto-generated identity primary key.

```sql
id INTEGER GENERATED ALWAYS AS IDENTITY
```

Primary key constraints follow the convention:

```
{dt}_pk
```

Examples

```
users_pk
orders_pk
products_pk
```

---

## Public IDs

Entities exposed through the API contain

```sql
public_id VARCHAR(...) UNIQUE NOT NULL
```

A unique constraint is applied following the project's naming convention.

---

## Foreign Keys

Foreign key columns reference the primary key of another table.

Constraint naming convention:

```
fk_{dt}_{st}
```

Examples

```
fk_cart_items_carts
fk_cart_items_product_variants
fk_product_variants_products
fk_inventory_product_variants
```

---

## Unique Constraints

Unique constraints follow the convention:

```
{dt}_{sc}_unique_key
```

Examples

```
users_email_unique_key
users_phone_number_unique_key
products_slug_unique_key
product_variants_sku_unique_key
```

> Note: unique constraints that span a foreign-key column only (no meaningful source column) use `{dt}__unique_key` (double underscore), e.g., `coupon_usages__unique_key` (on `orders_id`), `inventory__unique_key` (on `product_variants_id`), `payments__unique_key` (on `orders_id`), and `shipments__unique_key` (on `orders_id`).

---

## Check Constraints

Check constraints follow:

```
ck_{dt}_{rule}
```

Examples

```
ck_products_price_positive
ck_reviews_rating_range
ck_inventory_quantity_non_negative
```

> Note: the following tables contain database-level check constraints (flagged in `prisma/schema.prisma` by the `/// This table contains check constraints…` comment; these require additional setup for migrations):
>
> - cart_items
> - coupon_usages
> - coupons
> - inventory
> - order_items
> - orders
> - payments
> - product_variants
> - reviews
> - shipments
>
> The naming convention above applies to any check constraint introduced in the future.

---

## Indexes

Indexes follow the convention:

```
idx_{dt}_{sc}
```

Examples

```
idx_users_email
idx_users_public_id
idx_products_slug
idx_orders_user_id
idx_product_variants_product_id
```

> Note: several legacy index names reference the singular conceptual column rather than the actual foreign-key column (e.g., `idx_orders_user_id` indexes `users_id`, `idx_product_variants_product_id` indexes `products_id`, `idx_cart_items_cart_id` indexes `carts_id`). Index map names are authoritative.

---

## Triggers

Triggers follow:

```
trg_{dt}_{action}
```

Examples

```
trg_users_updated_at
trg_orders_audit
```

---

## Trigger Functions

Database functions follow:

```
fn_{purpose}
```

Examples

```
fn_update_updated_at
fn_generate_public_id
```

---

## Naming Placeholders

| Placeholder | Description |
| --- | --- |
| `{dt}` | Destination (child) table that owns the constraint |
| `{st}` | Source (parent) table being referenced |
| `{sc}` | Source column name |

Example

```
products (id)
    ▲
    │
product_variants (products_id)
```

Produces

```
Column:
products_id

Primary Key:
product_variants_pk

Foreign Key:
fk_product_variants_products

Unique Constraint:
product_variants_sku_unique_key

Foreign Key Index:
idx_product_variants_product_id
```

---

# Domains

---

## Authentication

### users

#### Description

Stores customer account information.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(32)` | No | Public identifier |
| email | `VARCHAR(320)` | No | User email |
| phone_number | `VARCHAR(20)` | No | Phone number in E.164 format |
| first_name | `VARCHAR(100)` | No | First name |
| last_name | `VARCHAR(100)` | No | Last name |
| password_hash | `VARCHAR(255)` | No | Password hash |
| email_verified_at | `TIMESTAMP` | Yes | Email verification timestamp |
| phone_verified_at | `TIMESTAMP` | Yes | Phone verification timestamp |
| role | `user_role` | No | User role |
| status | `user_status` | No | Account status |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | users_pk |
| Unique | users_public_id_unique_key |
| Unique | users_email_unique_key |
| Unique | users_phone_number_unique_key |

#### Indexes

- idx_users_public_id
- idx_users_email

#### Relationships

- One user → many sessions
- One user → many user_addresses
- One user → many orders
- One user → many carts
- One user → many reviews
- One user → many coupon usages
- One user → many payments
- One user → many verification tokens
- One user → many password reset tokens

---

### sessions

#### Description

Stores authenticated user sessions and device metadata for session-based authentication. Each record represents a single login session and is used to validate authenticated requests, manage active devices, and support session revocation.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(32)` | No | Public session identifier |
| refresh_token_hash | `VARCHAR(255)` | No | Hashed refresh token associated with the session |
| expires_at | `TIMESTAMPTZ` | No | Session expiration timestamp |
| revoked_at | `TIMESTAMPTZ` | Yes | Timestamp when the session was revoked |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| last_activity_at | `TIMESTAMPTZ` | Yes | Timestamp of the most recent authenticated request |
| ip_address | `INET` | Yes | IP address used to create the session |
| user_agent | `TEXT` | Yes | Raw User-Agent string of the client |
| device_name | `VARCHAR(100)` | Yes | Parsed device name (e.g., Chrome on Windows) |
| country | `VARCHAR(100)` | Yes | Country inferred from the IP address |
| city | `VARCHAR(100)` | Yes | City inferred from the IP address |
| is_current | `BOOLEAN` | No | Indicates whether this is the user's current active session |
| users_id | `INTEGER` | No | Reference to the authenticated user |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | sessions_pk |
| Foreign Key | fk_sessions_users |
| Unique | sessions_public_id_unique_key |

#### Indexes

- idx_sessions_public_id
- idx_sessions_user_id
- idx_sessions_refresh_token_hash
- idx_sessions_expires_at

#### Relationships

- Many sessions → One user

---

### verification_tokens

#### Description

Stores one-time verification tokens for account verification workflows, such as email and phone verification. Each token is associated with a user and a verification purpose.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(32)` | No | Public token identifier |
| token_hash | `VARCHAR(255)` | No | Hashed verification token |
| used_at | `TIMESTAMPTZ` | Yes | Timestamp when the token was successfully used |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| expires_at | `TIMESTAMPTZ` | No | Token expiration timestamp |
| target | `VARCHAR(100)` | No | Targeted email or phone number |
| purpose | `verification_type` | Yes | Verification purpose |
| verified_at | `TIMESTAMPTZ` | Yes | Timestamp when the target was verified |
| users_id | `INTEGER` | No | Reference to the associated user |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | verification_tokens_pk |
| Foreign Key | fk_verification_tokens_users |
| Unique | verification_tokens_public_id_unique_key |

#### Indexes

- idx_verification_tokens_public_id
- idx_verification_tokens_token_hash
- idx_verification_tokens_verification_type
- idx_verification_tokens_expires_at
- idx_verification_tokens_user_id

#### Relationships

- Many verification_tokens → One user

---

### password_reset_tokens

#### Description

Stores one-time tokens used to securely reset a user's password. Each token is associated with a single user and becomes invalid after being used or when it expires.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public token identifier |
| token_hash | `VARCHAR(255)` | Yes | Hashed password reset token |
| expires_at | `TIMESTAMPTZ` | No | Token expiration timestamp |
| used_at | `TIMESTAMPTZ` | Yes | Timestamp when the token was successfully used |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| users_id | `INTEGER` | No | Reference to the user requesting the password reset |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | password_reset_tokens_pk |
| Foreign Key | fk_password_reset_tokens_users |
| Unique | password_reset_tokens_public_id_unique_key |

#### Indexes

- idx_password_reset_tokens_public_id
- idx_password_reset_tokens_user_id
- idx_password_reset_tokens_token_hash
- idx_password_reset_tokens_expires_at

#### Relationships

- Many password_reset_tokens → One user

---

## Addresses

### user_addresses

#### Description

Stores the saved addresses associated with a user account. Each record represents a reusable shipping and/or billing address that can be selected during checkout. Orders store a snapshot of the selected address to preserve historical accuracy, so updates to saved addresses do not affect existing orders.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public address identifier |
| recipient_name | `VARCHAR(100)` | No | Full name of the recipient |
| phone_number | `VARCHAR(20)` | No | Recipient contact phone number |
| label | `VARCHAR(50)` | Yes | User-defined label (e.g., Home, Work) |
| country | `VARCHAR(100)` | No | Country |
| state | `VARCHAR(100)` | No | State, province, or governorate |
| city | `VARCHAR(100)` | No | City |
| address_1 | `TEXT` | No | Primary street address |
| address_2 | `TEXT` | Yes | Secondary address information (e.g., apartment, suite) |
| zip_code | `VARCHAR(20)` | Yes | Postal or ZIP code |
| users_id | `INTEGER` | No | Reference to the address owner |
| is_default_shipping | `BOOLEAN` | No | Indicates whether this is the user's default shipping address |
| is_default_billing | `BOOLEAN` | No | Indicates whether this is the user's default billing address |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | user_addresses_pk |
| Foreign Key | fk_user_addresses_users |
| Unique | user_addresses_public_id_unique_key |

#### Indexes

- idx_user_addresses_public_id
- idx_user_addresses_user_id
- idx_user_addresses_default_shipping
- idx_user_addresses_default_billing
- idx_user_addresses_deleted_at

#### Relationships

- Many user_addresses → One user
- One user_address → Many orders

---

## Product Catalog

### products

#### Description

Stores the core information of a product. A product represents the parent entity for one or more purchasable variants and contains data shared across all variants.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public product identifier |
| name | `VARCHAR(255)` | No | Product name |
| slug | `VARCHAR(255)` | No | SEO-friendly unique URL slug |
| description | `TEXT` | Yes | Detailed product description |
| brand | `VARCHAR(255)` | Yes | Product brand or manufacturer |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | products_pk |
| Unique | products_public_id_unique_key |
| Unique | products_slug_unique_key |

#### Indexes

- idx_products_public_id
- idx_products_slug
- idx_products_name
- idx_products_brand

#### Relationships

- One product → Many product_variants
- One product → Many product_images
- One product → Many product_categories
- One product → Many reviews

---

### product_variants

#### Description

Stores purchasable variations of a product. Each variant represents a unique combination of options (such as size or color) and maintains its own pricing, SKU, and inventory.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public variant identifier |
| price | `DECIMAL(10,2)` | No | Selling price of the variant |
| discount_percentage | `DECIMAL(5,2)` | Yes | Discount percentage applied to the variant |
| color | `VARCHAR(50)` | Yes | Variant color |
| size | `VARCHAR(50)` | Yes | Variant size |
| status | `product_status` | Yes | Indicates whether the variant is available for purchase |
| sku | `VARCHAR(80)` | No | Stock Keeping Unit used for inventory management |
| barcode | `TEXT` | Yes | Barcode value of the variant |
| cost_price | `DECIMAL(10,2)` | Yes | Internal cost of the variant |
| weight | `DECIMAL(10,2)` | Yes | Weight of the variant |
| width | `DECIMAL(10,2)` | Yes | Width of the variant |
| height | `DECIMAL(10,2)` | Yes | Height of the variant |
| length | `DECIMAL(10,2)` | Yes | Length of the variant |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |
| products_id | `INTEGER` | No | Reference to the parent product |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | product_variants_pk |
| Foreign Key | fk_product_variants_products |
| Unique | product_variants_public_id_unique_key |
| Unique | product_variants_sku_unique_key |

#### Indexes

- idx_product_variants_public_id
- idx_product_variants_product_id
- idx_product_variants_sku
- idx_product_variants_price

#### Relationships

- Many product_variants → One product
- One product_variant → One inventory
- One product_variant → Many product_variant_images
- One product_variant → Many cart_items
- One product_variant → Many order_items

---

### product_images

#### Description

Stores images associated with a product. These images represent the product as a whole and are shared across all product variants.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| products_id | `INTEGER` | No | Reference to the associated product |
| public_id | `VARCHAR(50)` | No | Public image identifier |
| image_url | `VARCHAR(2048)` | No | URL of the stored product image |
| is_primary | `BOOLEAN` | No | Indicates whether this image is the primary product image |
| display_order | `INTEGER` | No | Display order of the image within the product gallery |
| alt_text | `TEXT` | Yes | Alternative text describing the image |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | product_images_pk |
| Foreign Key | fk_product_images_products |
| Unique | product_images_public_id_unique_key |

#### Indexes

- idx_product_images_public_id
- idx_product_images_product_id
- idx_product_images_display_order

#### Relationships

- Many product_images → One product

---

### product_variant_images

#### Description

Stores images specific to individual product variants. These images represent attributes unique to a variant, such as color, material, or style, and override or supplement the product's shared images.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public image identifier |
| image_url | `VARCHAR(2048)` | No | URL of the stored variant image |
| product_variants_id | `INTEGER` | No | Reference to the associated product variant |
| display_order | `INTEGER` | No | Display order of the image within the variant gallery |
| alt_text | `VARCHAR(255)` | Yes | Alternative text describing the image |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | product_variant_images_pk |
| Foreign Key | fk_product_variant_images_product_variants |
| Unique | product_variant_images_public_id_unique_key |

#### Indexes

- idx_product_variant_images_public_id
- idx_product_variant_images_product_variant_id
- idx_product_variant_images_display_order

#### Relationships

- Many product_variant_images → One product_variant

---

### categories

#### Description

Stores product category definitions used to organize and classify products. Categories are reusable and can be associated with multiple products.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public category identifier |
| name | `VARCHAR(255)` | No | Category name |
| slug | `VARCHAR(255)` | No | SEO-friendly unique URL slug |
| description | `TEXT` | Yes | Description of the category |
| is_active | `BOOLEAN` | No | Indicates whether the category is available for assignment |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | category_pk |
| Unique | categories_public_id_unique_key |
| Unique | categories_slug_unique_key |
| Unique | categories_name_unique_key |

#### Indexes

- idx_categories_public_id
- idx_categories_slug
- idx_categories_name

#### Relationships

- One category → Many product_categories
- Many categories → Many products (via product_categories)

---

### product_categories

#### Description

Associates products with categories, enabling a many-to-many relationship between the two entities. Each record links a single product to a single category.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| categories_id | `INTEGER` | No | Reference to the associated category |
| products_id | `INTEGER` | No | Reference to the associated product |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | product_categories_pk |
| Foreign Key | fk_product_categories_categories |
| Foreign Key | fk_product_categories_products |
| Unique | product_categories_product_id_category_id_unique_key |

#### Indexes

- idx_product_categories_product_id
- idx_product_categories_category_id

#### Relationships

- Many product_categories → One product
- Many product_categories → One category

---

## Inventory

### inventory

#### Description

Stores inventory information for each product variant. Each inventory record tracks the available and reserved stock quantities, enabling accurate inventory management and order fulfillment.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| quantity_on_hand | `INTEGER` | No | Total quantity currently in stock |
| reorder_level | `INTEGER` | Yes | Stock threshold that indicates when replenishment is recommended |
| quantity_reserved | `INTEGER` | Yes | Quantity reserved for pending orders |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| last_stock_update | `TIMESTAMPTZ` | No | Timestamp of the most recent stock update |
| product_variants_id | `INTEGER` | No | Reference to the associated product variant |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | inventory_pk |
| Foreign Key | fk_inventory_product_variants |
| Unique | inventory__unique_key |

#### Indexes

- idx_inventory_product_variant_id

#### Relationships

- One inventory → One product_variant

---

## Shopping Cart

### carts

#### Description

Stores shopping carts for users. Each cart acts as a container for items a user intends to purchase before placing an order.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public cart identifier |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| users_id | `INTEGER` | No | Reference to the cart owner |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | carts_pk |
| Foreign Key | fk_carts_users |
| Unique | carts_public_id_unique_key |

#### Indexes

- idx_carts_public_id
- idx_carts_user_id

#### Relationships

- Many carts → One user
- One cart → Many cart_items

---

### cart_items

#### Description

Stores the product variants added to a shopping cart. Each cart item represents a selected product variant along with the desired quantity at the time it was added to the cart.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| quantity | `INTEGER` | No | Quantity of the product variant in the cart |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| carts_id | `INTEGER` | No | Reference to the associated shopping cart |
| product_variants_id | `INTEGER` | No | Reference to the selected product variant |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | cart_items_pk |
| Foreign Key | fk_cart_items_carts |
| Foreign Key | fk_cart_items_product_variants |

#### Indexes

- idx_cart_items_cart_id
- idx_cart_items_product_variant_id

#### Relationships

- Many cart_items → One cart
- Many cart_items → One product_variant

---

## Orders

### orders

#### Description

Stores customer purchase orders. Each order represents a completed checkout and contains the overall order information, including pricing, status, shipping address, and payment details.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public order identifier |
| status | `order_status` | No | Current order status |
| shipping_cost | `DECIMAL(10,2)` | No | Shipping cost charged for the order |
| subtotal | `DECIMAL(10,2)` | No | Total price before discounts, shipping, and taxes |
| order_number | `VARCHAR(50)` | No | Human-readable unique order number |
| discount_amount | `DECIMAL(10,2)` | No | Total discount applied to the order |
| shipping_fee | `DECIMAL(10,2)` | No | Shipping fee charged to the customer |
| tax_amount | `DECIMAL(10,2)` | No | Total tax charged for the order |
| total_amount | `DECIMAL(10,2)` | No | Final amount paid by the customer |
| notes | `TEXT` | Yes | Customer notes associated with the order |
| placed_at | `TIMESTAMPTZ` | No | Timestamp when the order was placed |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| users_id | `INTEGER` | No | Reference to the customer who placed the order |
| coupons_id | `INTEGER` | Yes | Reference to the applied coupon, if any |
| user_addresses_id | `INTEGER` | No | Reference to the shipping address used for the order |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | orders_pk |
| Foreign Key | fk_orders_users |
| Foreign Key | fk_orders_user_addresses |
| Foreign Key | fk_orders_coupons |
| Unique | orders_public_id_unique_key |
| Unique | orders_order_number_unique_key |

#### Indexes

- idx_orders_public_id
- idx_orders_user_id
- idx_orders_user_address_id
- idx_orders_coupon_id
- idx_orders_order_number
- idx_orders_status
- idx_orders_placed_at

#### Relationships

- Many orders → One user
- Many orders → One user_address
- Many orders → One coupon
- One order → Many order_items
- One order → One coupon_usage
- One order → One payment
- One order → One shipment

---

### order_items

#### Description

Stores the individual products purchased within an order. Each order item is an immutable snapshot of the product variant at the time the order was placed — product context (`product_name`, `product_slug`, `sku`, variant attributes) and pricing (`unit_price`, `discount_percentage`, `total_amount`) — ensuring historical accuracy even if the original product changes later.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| quantity | `INTEGER` | No | Quantity purchased |
| unit_price | `DECIMAL(10,2)` | No | Snapshot of the charged unit price at the time of purchase |
| total_amount | `DECIMAL(10,2)` | No | Snapshot of the item line total after discounts |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| orders_id | `INTEGER` | No | Reference to the associated order |
| product_variants_id | `INTEGER` | No | Reference to the purchased product variant |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |
| product_name | `VARCHAR(255)` | No | Snapshot of the product name at the time of purchase |
| product_slug | `VARCHAR(255)` | No | Snapshot of the product slug at the time of purchase |
| sku | `VARCHAR(100)` | No | Snapshot of the variant SKU at the time of purchase |
| variant_color | `VARCHAR(100)` | Yes | Snapshot of the variant color, when set at purchase time |
| variant_size | `VARCHAR(100)` | Yes | Snapshot of the variant size, when set at purchase time |
| variant_weight | `DECIMAL(10,2)` | Yes | Snapshot of the variant weight, when set at purchase time |
| variant_width | `DECIMAL(10,2)` | Yes | Snapshot of the variant width, when set at purchase time |
| variant_length | `DECIMAL(10,2)` | Yes | Snapshot of the variant length, when set at purchase time |
| variant_height | `DECIMAL(10,2)` | Yes | Snapshot of the variant height, when set at purchase time |
| discount_percentage | `DECIMAL(5,2)` | Yes | Snapshot of the variant discount percentage, when set at purchase time |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | order_items_pk |
| Foreign Key | fk_order_items_orders |
| Foreign Key | fk_order_items_product_variants |

#### Indexes

- idx_order_items_order_id
- idx_order_items_product_variant_id

#### Relationships

- Many order_items → One order
- Many order_items → One product_variant

---

### shipments

#### Description

Stores shipment information for customer orders. Each shipment tracks the fulfillment and delivery details for a single order (1:1 with `orders`) and also holds the immutable shipping-address snapshot copied from the selected `user_addresses` row at checkout, so later edits to saved addresses never alter historical order data.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public shipment identifier |
| status | `VARCHAR(30)` | No | Current shipment status |
| carrier | `VARCHAR(100)` | Yes | Shipping carrier name |
| tracking_number | `VARCHAR(100)` | Yes | Carrier tracking number |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| shipped_at | `TIMESTAMPTZ` | Yes | Timestamp when the shipment was dispatched |
| delivered_at | `TIMESTAMPTZ` | Yes | Timestamp when the shipment was delivered |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| orders_id | `INTEGER` | No | Reference to the associated order |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |
| recipient_name | `VARCHAR(100)` | No | Snapshot of the shipping recipient name at checkout |
| phone_number | `VARCHAR(20)` | No | Snapshot of the shipping contact phone at checkout |
| country | `VARCHAR(100)` | No | Snapshot of the shipping country at checkout |
| state | `VARCHAR(100)` | Yes | Snapshot of the shipping state at checkout, when set |
| city | `VARCHAR(100)` | No | Snapshot of the shipping city at checkout |
| address_1 | `VARCHAR(100)` | No | Snapshot of the shipping address line 1 at checkout |
| address_2 | `VARCHAR(100)` | Yes | Snapshot of the shipping address line 2 at checkout, when set |
| postal_code | `VARCHAR(20)` | Yes | Snapshot of the shipping postal code at checkout, when set |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | shipments_pk |
| Foreign Key | fk_shipments_orders |
| Unique | shipments_public_id_unique_key |
| Unique | shipments__unique_key |
| Unique | shipments_tracking_number_unique_key |

#### Indexes

- idx_shipments_public_id
- idx_shipments_order_id
- idx_shipments_tracking_number
- idx_shipments_status

#### Relationships

- One shipment → One order

---

## Payments

### payments

#### Description

Stores payment records for customer orders. Each record represents the payment attempt for exactly one order (1:1 via the unique `orders_id`) and tracks its processing status (`payment_status` enum), provider transaction reference, and lifecycle timestamps (`paid_at`, `failed_at`, `refunded_at`).

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public payment identifier |
| amount | `DECIMAL(10,2)` | No | Total payment amount |
| payment_method | `VARCHAR(50)` | No | Payment method used by the customer |
| status | `payment_status` | No | Current payment status |
| transaction_reference | `VARCHAR(255)` | Yes | External payment provider transaction reference (unique when set) |
| paid_at | `TIMESTAMPTZ` | Yes | Timestamp when the payment was successfully completed |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| users_id | `INTEGER` | No | Reference to the user associated with the payment |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |
| failed_at | `TIMESTAMPTZ` | Yes | Timestamp when the payment failed |
| refunded_at | `TIMESTAMPTZ` | Yes | Timestamp when the payment was refunded |
| orders_id | `INTEGER` | No | Reference to the order paid for by this payment |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | payments_pk |
| Foreign Key | fk_payments_users |
| Foreign Key | fk_payments_orders |
| Unique | payments_public_id_unique_key |
| Unique | payments_transaction_reference_unique_key |
| Unique | payments__unique_key |

#### Indexes

- idx_payments_order_id
- idx_payments_paid_at
- idx_payments_public_id
- idx_payments_status
- idx_payments_transaction_reference

#### Relationships

- Many payments → One user
- One payment → One order

---

## Promotions

### coupons

#### Description

Stores promotional coupons that can be applied to customer orders. Coupons define discount rules, validity periods, and usage limitations.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public coupon identifier |
| code | `VARCHAR(50)` | No | Unique coupon code entered by the customer |
| discount_type | `discount_type` | No | Type of discount (e.g., `PERCENTAGE`, `FIXED_AMOUNT`) |
| discount_value | `DECIMAL(10,2)` | No | Discount amount or percentage value |
| minimum_order_amount | `DECIMAL(10,2)` | Yes | Minimum order subtotal required to apply the coupon |
| maximum_discount_amount | `DECIMAL(10,2)` | Yes | Maximum discount allowed for percentage-based coupons |
| usage_limit | `INTEGER` | No | Maximum number of times the coupon can be redeemed |
| usage_limit_per_user | `INTEGER` | No | Maximum number of times the coupon can be redeemed per user |
| usage_count | `INTEGER` | No | Number of times the coupon has been redeemed |
| starts_at | `TIMESTAMPTZ` | Yes | Timestamp when the coupon becomes valid |
| expires_at | `TIMESTAMPTZ` | Yes | Timestamp when the coupon expires |
| is_active | `BOOLEAN` | No | Indicates whether the coupon can currently be used |
| created_at | `TIMESTAMPTZ` | No | Creation timestamp |
| updated_at | `TIMESTAMPTZ` | No | Last modification timestamp |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | coupons_pk |
| Unique | coupons_public_id_unique_key |
| Unique | coupons_code_unique_key |

#### Indexes

- idx_coupons_public_id
- idx_coupons_code
- idx_coupons_is_active
- idx_coupons_starts_at
- idx_coupons_expires_at

#### Relationships

- One coupon → Many orders
- One coupon → Many coupon_usages

---

### coupon_usages

#### Description

Stores the redemption history of coupons. Each record represents a successful coupon usage by a user for a specific order, providing an audit trail for coupon usage and enforcing usage limits.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| discount_amount | `DECIMAL(10,2)` | No | Actual discount applied to the order |
| redeemed_at | `TIMESTAMPTZ` | No | Timestamp when the coupon was redeemed |
| users_id | `INTEGER` | No | Reference to the user who redeemed the coupon |
| coupons_id | `INTEGER` | No | Reference to the redeemed coupon |
| orders_id | `INTEGER` | No | Reference to the order where the coupon was applied |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | coupon_usages_pk |
| Foreign Key | fk_coupon_usages_coupons |
| Foreign Key | fk_coupon_usages_users |
| Foreign Key | fk_coupon_usages_orders |
| Unique | coupon_usages__unique_key |

#### Indexes

- idx_coupon_usages_coupon_id
- idx_coupon_usages_users_id
- idx_coupon_usages_orders_id
- idx_coupon_usages_redeemed_at

#### Relationships

- Many coupon_usages → One coupon
- Many coupon_usages → One user
- One coupon_usage → One order

---

## Reviews

### reviews

#### Description

Stores customer reviews and ratings for purchased products. Reviews allow customers to share feedback based on their purchase experience.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| public_id | `VARCHAR(50)` | No | Public review identifier |
| rating | `SMALLINT` | No | Product rating from 1 to 5 |
| title | `VARCHAR(255)` | Yes | Short review title |
| comment | `TEXT` | Yes | Customer review content |
| created_at | `TIMESTAMPTZ` | No | Timestamp when the review was created |
| updated_at | `TIMESTAMPTZ` | No | Timestamp when the review was last updated |
| deleted_at | `TIMESTAMPTZ` | Yes | Soft deletion timestamp |
| is_approved | `BOOLEAN` | No | Indicates whether the review is publicly visible |
| users_id | `INTEGER` | No | Reference to the user who created the review |
| products_id | `INTEGER` | No | Reference to the reviewed product |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | reviews_pk |
| Foreign Key | fk_reviews_users |
| Foreign Key | fk_reviews_products |
| Unique | reviews_public_id_unique_key |

#### Indexes

- idx_reviews_public_id
- idx_reviews_user_id
- idx_reviews_product_id
- idx_reviews_is_approved
- idx_reviews_rating

#### Relationships

- Many reviews → One user
- Many reviews → One product
- One review → Many review_images

---

### review_images

#### Description

Stores images attached to customer reviews. These images provide visual evidence or additional context for the customer's review and are associated with a single review.

#### Columns

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| id | `INTEGER` | No | Internal primary key |
| image_url | `TEXT` | No | URL of the stored review image |
| alt_text | `VARCHAR(255)` | Yes | Alternative text describing the image |
| display_order | `INTEGER` | Yes | Display order of the image within the review |
| created_at | `TIMESTAMPTZ` | No | Timestamp when the image was created |
| updated_at | `TIMESTAMPTZ` | No | Timestamp when the image was last updated |
| reviews_id | `INTEGER` | Yes | Reference to the associated review |
| public_id | `VARCHAR(50)` | No | Public image identifier |

#### Constraints

| Constraint | Name |
| --- | --- |
| Primary Key | review_images_pk |
| Foreign Key | fk_review_images_reviews |
| Unique | review_images_public_id_unique_key |

#### Indexes

- idx_review_images_public_id
- idx_review_images_review_id
- idx_review_images_display_order

#### Relationships

- Many review_images → One review

---

# Common Columns

The following columns are used consistently throughout the schema.

| Column | Purpose |
| --- | --- |
| id | Internal primary key |
| public_id | External identifier |
| created_at | Creation timestamp |
| updated_at | Last modification timestamp |
| deleted_at | Soft deletion timestamp (where applicable) |

> Note: `product_variant_images` has no `created_at`/`updated_at` columns. This deviation is intentional in the current schema.

---

# Enumerations

## user_status

- ACTIVE
- SUSPENDED
- DELETED

---

## discount_type

- FIXED_AMOUNT
- PERCENTAGE

---

## order_status

- PENDING
- CONFIRMED
- PROCESSING
- SHIPPED
- DELIVERED
- CANCELLED
- RETURNED
- REFUNDED

---

## payment_status

- PENDING
- AUTHORIZED
- PAID
- FAILED
- REFUNDED

---

## product_status

- ACTIVE
- DRAFT
- INACTIVE
- ARCHIVED

---

## session_status

- ACTIVE
- REVOKED
- EXPIRED

---

## user_role

- CUSTOMER
- ADMIN
- SUPER_ADMIN

---

## verification_type

- REGISTER_EMAIL
- CHANGE_EMAIL
- PASSWORD_RESET
- CHANGE_PHONE_NUMBER

---

# Indexing Strategy

Indexes are created for:

- Primary keys
- Foreign keys
- Public IDs
- Email addresses
- Slugs
- Frequently queried columns
- Composite query patterns

Additional composite indexes are introduced based on query performance requirements.

---

# Soft Delete Policy

Soft deletion (`deleted_at`) is supported by:

- users
- user_addresses
- products
- product_variants
- categories
- coupons
- reviews
- order_items
- payments
- shipments

Historical records such as orders and coupon_usages are never soft deleted.

---

# Referential Integrity

All relationships enforce foreign key constraints.

Cascade behavior follows business rules.

Examples:

- Product → Product Images (`ON DELETE CASCADE`)
- Product → Product Variants (`ON DELETE CASCADE`)
- Order → Order Items (`ON DELETE CASCADE`)

Relationships containing historical business data should generally use `RESTRICT` or `NO ACTION` to preserve data integrity.

---

# Migration Strategy

All schema changes are managed through versioned database migrations.

Backward-incompatible changes require an explicit migration plan.

Direct modification of production databases outside the migration process is prohibited.
