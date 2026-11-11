import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../../../src/shared/errors/ForbiddenError.js";
import { UnauthorizedError } from "../../../src/shared/errors/UnauthorizedError.js";
import {
  demoAdminAccess,
  demoPublicPrincipal,
  demoResponseSanitizer,
  maskDemoBody,
} from "../../../src/middleware/demoMode.js";
import { authentication } from "../../../src/middleware/authentication.js";

// env is imported at module scope by demoMode.ts; keep the mock mutable so
// individual tests can toggle ENABLE_DEMO_MODE.
const envMock = vi.hoisted(() => ({
  ENABLE_DEMO_MODE: false,
  SESSION_SECRET: "test-session-secret-value",
}));
vi.mock("../../../src/config/env.js", () => ({ env: envMock }));

// authentication.ts pulls the session repository/token utils (which reach for
// Prisma and crypto); the demo branch must never touch them, so stub both.
vi.mock("../../../src/modules/auth/utils/tokens.js", () => ({
  hashToken: (token: string) => `hash:${token}`,
}));
vi.mock("../../../src/modules/auth/repository/auth.repository.js", () => ({
  authRepository: {
    findSessionByTokenHash: vi.fn(),
    touchSession: vi.fn(),
  },
}));

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/products",
    cookies: {},
    originalUrl: "/api/v1/admin/products",
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  return { res: { json } as unknown as Response, json };
}

describe("demoAdminAccess", () => {
  beforeEach(() => {
    envMock.ENABLE_DEMO_MODE = false;
  });

  it("passes every request through untouched when demo mode is off", () => {
    const next = vi.fn();
    const { res } = makeRes();

    demoAdminAccess(makeReq(), res, next);

    expect(next).toHaveBeenCalledWith();
    expect((makeReq() as Request).isDemoPublicRead).toBeUndefined();
  });

  it("flags unauthenticated GET requests when demo mode is on", () => {
    envMock.ENABLE_DEMO_MODE = true;
    const next = vi.fn();
    const req = makeReq();
    const { res } = makeRes();

    demoAdminAccess(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.isDemoPublicRead).toBe(true);
  });

  it("rejects unauthenticated write methods with 403 before routers run", () => {
    envMock.ENABLE_DEMO_MODE = true;
    const { res } = makeRes();

    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const next = vi.fn();
      demoAdminAccess(makeReq({ method }), res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0] as ForbiddenError;
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toMatch(/read-only/i);
    }
  });

  it("keeps sensitive sections (settings/admins/audit) behind real auth", () => {
    envMock.ENABLE_DEMO_MODE = true;
    const { res } = makeRes();

    for (const path of ["/settings", "/settings/general", "/admins", "/audit"]) {
      const next = vi.fn();
      demoAdminAccess(makeReq({ path }), res, next);

      const error = next.mock.calls[0][0] as ForbiddenError;
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toMatch(/not available in demo/i);
    }
  });

  it("never exposes signed ImageKit upload credentials publicly", () => {
    envMock.ENABLE_DEMO_MODE = true;
    const next = vi.fn();
    const { res } = makeRes();

    demoAdminAccess(
      makeReq({ path: "/products/p_products01/uploads/imagekit-auth" }),
      res,
      next,
    );

    const error = next.mock.calls[0][0] as ForbiddenError;
    expect(error.statusCode).toBe(403);
  });

  it("defers requests carrying a session cookie to the normal auth flow", () => {
    envMock.ENABLE_DEMO_MODE = true;
    const next = vi.fn();
    const req = makeReq({ cookies: { session: "some-session-token" } });
    const { res } = makeRes();

    demoAdminAccess(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.isDemoPublicRead).toBeUndefined();
  });

  it("admits unauthenticated GETs even when a real admin would see more", () => {
    envMock.ENABLE_DEMO_MODE = true;
    const next = vi.fn();
    const req = makeReq({ path: "/analytics" });
    const { res } = makeRes();

    demoAdminAccess(req, res, next);

    expect(req.isDemoPublicRead).toBe(true);
  });
});

describe("demoResponseSanitizer", () => {
  it("leaves responses untouched for non-demo requests", () => {
    const next = vi.fn();
    const { res, json } = makeRes();

    demoResponseSanitizer(makeReq(), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.json).toBe(json);
  });

  it("masks customer PII recursively in demo responses", () => {
    envMock.ENABLE_DEMO_MODE = true;
    const req = makeReq();
    req.isDemoPublicRead = true;
    const { res, json } = makeRes();
    demoResponseSanitizer(req, res, vi.fn());

    const body = {
      success: true,
      data: [
        {
          public_id: "ord_orders01",
          total: "149.90",
          customer_email: "jane.doe@example.com",
          customer_name: "Jane Doe",
          phone_number: "01012345678",
          shipping_address: {
            recipient_name: "Jane Doe",
            address_1: "12 Ramses St",
            address_2: "Apt 4",
            postal_code: "11511",
            city: "Cairo",
            country: "EG",
          },
          items: [{ product_name: "Espresso Machine", email: "no@pe.no" }],
        },
      ],
      pagination: { page: 1, limit: 20, total: 1 },
    };

    res.json(body);

    expect(json).toHaveBeenCalledTimes(1);
    const masked = json.mock.calls[0][0] as typeof body;
    const order = (masked.data as Array<Record<string, unknown>>)[0];
    const address = order.shipping_address as Record<string, unknown>;
    const items = order.items as Array<Record<string, unknown>>;

    expect(order.customer_email).toBe("j***@***.***");
    expect(order.customer_name).toBe("J***");
    expect(order.phone_number).toBe("***5678");
    expect(address.recipient_name).toBe("J***");
    expect(address.address_1).toBe("***");
    expect(address.address_2).toBe("***");
    expect(address.postal_code).toBe("***");
    // Weakly-identifying geography and business data stay intact.
    expect(address.city).toBe("Cairo");
    expect(address.country).toBe("EG");
    expect(items[0].product_name).toBe("Espresso Machine");
    expect(items[0].email).toBe("n***@***.***");
    // Envelope structure and money strings are preserved.
    expect(masked.success).toBe(true);
    expect(order.total).toBe("149.90");
    expect(masked.pagination).toEqual({ page: 1, limit: 20, total: 1 });
  });

  it("keeps null and non-string PII values safe without crashing", () => {
    expect(
      maskDemoBody({ phone_number: null, nested: { first_name: 42 } }),
    ).toEqual({ phone_number: null, nested: { first_name: "4***" } });
  });

  it("passes Date values through untouched instead of emptying them", () => {
    const at = new Date("2026-01-02T03:04:05Z");
    const masked = maskDemoBody({
      created_at: at,
      customer_email: "a@b.com",
      nested: { updated_at: at },
    }) as Record<string, unknown>;

    expect(masked.created_at).toBe(at);
    expect((masked.nested as Record<string, unknown>).updated_at).toBe(at);
    expect(masked.customer_email).toBe("a***@***.***");
  });
});

describe("authentication (demo branch)", () => {
  it("admits flagged unauthenticated reads with the synthetic principal and no DB call", async () => {
    const next = vi.fn();
    const req = makeReq();
    req.isDemoPublicRead = true;

    await authentication(req, makeRes().res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBe(demoPublicPrincipal);
    expect(req.userId).toBe("demo-public-visitor");
    expect(demoPublicPrincipal.id).toBeLessThan(0);
    expect(demoPublicPrincipal.role).toBe("SUPER_ADMIN");
  });

  it("still requires authentication for unauthenticated requests without the demo flag", async () => {
    const next = vi.fn();

    await authentication(makeReq(), makeRes().res, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as UnauthorizedError;
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.statusCode).toBe(401);
  });

  it("never admits the demo principal for write methods even if flagged", async () => {
    const next = vi.fn();
    const req = makeReq({ method: "POST" });
    req.isDemoPublicRead = true;

    await authentication(req, makeRes().res, next as NextFunction);

    const error = next.mock.calls[0][0] as UnauthorizedError;
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(req.user).toBeUndefined();
  });
});
