import dotenv from "dotenv";

dotenv.config({ path: ".env.test", override: false });
process.env.NODE_ENV = "test";

/**
 * Fail fast when the suite targets a non-test database. The destructive
 * catalog wipe in tests/helpers/db.ts must never be able to run against the
 * development (or any real) database. Defense has two layers:
 *  1. this guard — database or schema name must contain "test"
 *  2. cleanupTestData re-checks the same rule before deleting anything
 */
export function assertTestDatabase(url: string | undefined): void {
  if (!url) {
    throw new Error(
      "[test-guard] DATABASE_URL is not set. Copy .env.test.example to .env.test first.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("[test-guard] DATABASE_URL is not a valid URL.");
  }

  const schema = parsed.searchParams.get("schema") ?? "";
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const marker = /test/i;

  if (!marker.test(database) && !marker.test(schema)) {
    throw new Error(
      `[test-guard] Refusing to run tests against non-test database.\n` +
        `  database: "${database}"\n` +
        `  schema:   "${schema || "(default)"}"\n` +
        `Either the database name or the schema name must contain "test".\n` +
        `Point .env.test at an isolated test schema, e.g. ?schema=Ecommerce_test.`,
    );
  }
}

assertTestDatabase(process.env.DATABASE_URL);
