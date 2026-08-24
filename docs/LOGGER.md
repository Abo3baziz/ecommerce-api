# Logging Design Specification

## Purpose

Implement a centralized logging system for the application.

The logging system must:

* Log to the terminal while the server is running.
* Persist logs to append-only NDJSON files under `logs/`.
* Store logs in a structured JSON format (one JSON object per line).
* Append new log entries in O(1) — never re-read or rewrite existing content.
* Never persist raw credentials (tokens, OTPs, passwords) from URLs.

---

# Logging Library

Use **Pino** as the application's logger.

Requirements:

* JSON logs.
* Pretty-print output in development.
* Structured output in production.
* Single shared logger instance.
* No `console.log()`, `console.error()`, or other console methods outside the logger implementation.

---

# Log Destinations

Every log entry is written to both:

1. Terminal (stdout)
2. `logs/app.ndjson` (append-only, one JSON object per line)

Both outputs contain the same structured information.

> **Migration note:** the original design persisted a categorized,
> pretty-printed `logs/log.json` that was fully re-read and rewritten on every
> entry. That design was O(n²) per write, grew without bound, risked corruption
> on partial writes, and was unsafe with multiple instances. It was replaced by
> the append-only sink described here; `logs/log.json` is no longer written.

---

# File Behavior

* If `logs/app.ndjson` does not exist it is created on first write (directory created as needed).
* Entries are appended sequentially — existing content is never read back or modified.

## Rotation and retention

* When `app.ndjson` exceeds **5 MB**, it is rotated before the next write: the current file becomes `app.ndjson.1`.
* Older rotations shift (`app.ndjson.1` → `.2` → `.3`); a maximum of **3** rotated files are kept.
* Total on-disk footprint is therefore bounded at ~20 MB.

---

# Record Structure

Each line in `app.ndjson` is one JSON object:

```json
{
  "level": "success",
  "time": 1736184950739,
  "msg": "Request completed",
  "method": "GET",
  "url": "/health",
  "status": 200,
  "duration": 2,
  "requestId": "i_lQdGF0yeO7E8xX"
}
```

Levels are string labels (`success`, `info`, `warning`, `error`, `debug`) via Pino custom levels. The categorized view that the old `log.json` provided can be derived by filtering lines on `level`.

## Common Fields

Every log entry includes, when applicable:

* timestamp (`time`)
* level
* message (`msg`)
* requestId
* method
* url (**pathname only — query strings are stripped, see Redaction**)
* status
* duration
* userId
* ip
* userAgent

Error entries additionally include a serialized `err`:

* err.code
* err.message
* err.details
* err.stack (development only)

---

# URL Redaction

Request middleware logs `req.originalUrl`'s **pathname only**
(`stripUrlQuery` in `src/shared/logger/redact.ts`).

Email links embed single-use credentials (`?token=…` on verification,
email-change and password-reset links) and some flows pass OTPs or secrets
as query parameters. Because the entire query string is dropped, every such
value (token, otp, password, …) is kept out of persistent logs by design —
there is no key allowlist to maintain. Regression coverage:
`tests/unit/shared/logger.redact.test.ts`.

---

# Terminal Output

While the server is running, all logs continue to appear in the terminal.

Development output is human-readable (pino-pretty).

Production output remains structured JSON on stdout.

---

# Logging Guidelines

Log the following:

* Application startup
* Application shutdown
* Incoming requests
* Completed requests
* Authentication events
* Authorization failures
* Validation failures
* Database errors
* External API failures
* Unhandled exceptions
* Business events (order created, payment completed, user registered)
* Warnings
* Debug messages (development only)

Do not log:

* Passwords
* Session secrets
* JWTs
* OTP codes
* API keys
* Raw tokens (including URL query tokens)
* Credit card data
* Sensitive personal information

---

# Performance Considerations

* Logging failures must never crash the application.
* File writes are non-blocking and serialized through an internal promise chain.
* Each entry costs one O(1) append; rotation is a rename, not a copy.
* The logger is a shared singleton used throughout the application.

---

# Goal

The resulting logging system provides:

* Real-time terminal logging.
* Persistent structured NDJSON logs under `logs/` with bounded disk usage.
* O(1) appends with atomic renames for rotation.
* Credentials-free persistent output.
* A single centralized logging implementation used throughout the project.
