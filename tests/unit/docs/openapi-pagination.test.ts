import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// T-107: the paginated list envelope key is `pagination` — that is what every
// list controller emits and what the client's hasPagination() guard reads.
// The spec once documented `meta`, so this test pins the spec to the contract.
const spec = readFileSync(resolve(process.cwd(), "openapi/openapi.yaml"), "utf8");

describe("openapi pagination envelope contract", () => {
  it("documents every paginated list response under `pagination`", () => {
    const paginated = spec.match(/\$ref: '#\/components\/schemas\/PaginationMeta'/g) ?? [];
    expect(paginated.length).toBeGreaterThan(10);

    const refs = spec.match(/\n +meta:\r?\n +\$ref: '#\/components\/schemas\/PaginationMeta'/g) ?? [];
    expect(refs).toHaveLength(0);

    const paginationRefs = spec.match(/\n +pagination:\r?\n +\$ref: '#\/components\/schemas\/PaginationMeta'/g) ?? [];
    expect(paginationRefs.length).toBe(paginated.length);
  });

  it("does not describe a `meta` envelope key anywhere", () => {
    expect(spec).not.toMatch(/`meta`/);
    expect(spec).not.toMatch(/\n +meta:/);
  });
});
