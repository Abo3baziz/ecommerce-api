# Logging Design Specification

## Purpose

Implement a centralized logging system for the application.

The logging system must:

* Log to the terminal while the server is running.
* Persist logs to a local `logs/log.json` file.
* Store logs in a structured JSON format.
* Categorize logs by type.
* Append new log entries without overwriting existing ones.

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

Every log entry must be written to both:

1. Terminal (stdout)
2. `logs/log.json`

Both outputs must contain the same structured information.

---

# Log Categories

The JSON file must contain one top-level section for each log category.

```json
{
  "success": {},
  "info": {},
  "warning": {},
  "error": {},
  "debug": {}
}
```

Each category stores its own records.

---

# Record IDs

Each new log entry must receive the next sequential string key.

Example:

```json
{
  "error": {
    "1": {},
    "2": {},
    "3": {}
  }
}
```

The agent must determine the next available number before writing.

Existing records must never be overwritten.

---

# Success Log Structure

```json
{
  "success": {
    "1": {
      "timestamp": "2026-08-07T01:55:50.739Z",
      "level": "success",
      "method": "GET",
      "url": "/health",
      "status": 200,
      "duration": 2,
      "requestId": "i_lQdGF0yeO7E8xX",
      "message": "Health check completed."
    }
  }
}
```

---

# Error Log Structure

```json
{
  "error": {
    "1": {
      "timestamp": "2026-08-07T01:57:48.404Z",
      "level": "error",
      "method": "GET",
      "url": "/api/v1/health",
      "status": 404,
      "duration": 4,
      "requestId": "8EkbWYA25lyjeU2m",
      "error": {
        "code": "RESOURCE_NOT_FOUND",
        "message": "The requested resource was not found.",
        "details": null
      }
    }
  }
}
```

---

# Common Fields

Every log entry should include, when applicable:

* timestamp
* level
* message
* requestId
* method
* url
* status
* duration
* userId
* ip
* userAgent

Error logs should additionally include:

* error.code
* error.message
* error.details
* stack (development only)

---

# File Behavior

If `logs/log.json` does not exist:

* Create the directory.
* Create the file.
* Initialize it with:

```json
{
  "success": {},
  "info": {},
  "warning": {},
  "error": {},
  "debug": {}
}
```

---

# Write Rules

For every new log:

1. Read the current JSON file.
2. Determine the correct category.
3. Find the highest numeric key.
4. Increment it.
5. Insert the new log.
6. Save the updated JSON.
7. Never overwrite existing entries.

---

# Terminal Output

While the server is running, all logs must continue to appear in the terminal.

Development output should be human-readable.

Production output should remain structured JSON.

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
* Credit card data
* Sensitive personal information

---

# Performance Considerations

* Logging failures must never crash the application.
* File writes should be non-blocking where possible.
* The logger must be reusable throughout the application via dependency injection or a shared singleton.
* All application components should use the same logger instance.

---

# Goal

The resulting logging system should provide:

* Real-time terminal logging.
* Persistent structured logs in `logs/log.json`.
* Categorized log storage.
* Sequential log records.
* Consistent JSON structure across the entire application.
* A single centralized logging implementation used throughout the project.
