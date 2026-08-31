import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../src/app/index.js";
import { createAdminUser, createSuperAdminUser } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { prisma } from "../../../src/config/database.js";

describe("reports API", () => {
  beforeEach(async () => {
    await cleanupTestData();
    // operating_expenses and audit_logs are not fully wiped by cleanupTestData — clear test crumbs
    await prisma.operating_expenses.deleteMany({});
    await prisma.audit_logs.deleteMany({});
  });

  describe("GET /api/v1/admin/reports/pnl.pdf", () => {
    it("401 without authentication", async () => {
      const res = await request(app).get("/api/v1/admin/reports/pnl.pdf?period=month&year=2026&month=8");
      expect(res.status).toBe(401);
    });

    it("403 for ADMIN (super_admin only)", async () => {
      const { cookie } = await createAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=month&year=2026&month=8")
        .set("Cookie", cookie);
      expect(res.status).toBe(403);
    });

    it("400 when period=month without month", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=month&year=2026")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
    });

    it("400 when custom without dates", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=custom")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
    });

    it("400 when date_from >= date_to", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=custom&date_from=2026-08-10T00:00:00.000Z&date_to=2026-08-01T00:00:00.000Z")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
    });

    it("400 when custom range >366d", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=custom&date_from=2025-01-01T00:00:00.000Z&date_to=2026-02-01T00:00:00.000Z")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
    });

    it("400 on unknown currency", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=month&year=2026&month=8&currency=XYZ")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
    });

    it("400 when mixing period=year with date_from", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=year&year=2026&date_from=2026-01-01T00:00:00.000Z")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
    });

    it("200 pdf for month with attachment", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=month&year=2026&month=8")
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain('attachment; filename="pnl-2026-08.pdf"');
      expect(res.headers["cache-control"]).toBe("no-store");
      const buf = res.body as Buffer;
      expect(buf.slice(0, 5).toString()).toBe("%PDF-");
      expect(buf.length).toBeGreaterThan(1000);
    });

    it("200 pdf inline disposition", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=month&year=2026&month=8&disposition=inline")
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain('inline; filename="pnl-2026-08.pdf"');
    });

    it("200 with currency EGP header", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=month&year=2026&month=8&currency=EGP")
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["x-report-currency"]).toBe("EGP");
    });

    it("200 pdf for quarter monthly buckets", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=quarter&year=2026&quarter=2")
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain('pnl-2026-q2.pdf');
      const buf = res.body as Buffer;
      expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    });

    it("200 pdf for year", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=year&year=2026")
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain('pnl-2026.pdf');
    });

    it("200 pdf for custom range", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl.pdf?period=custom&date_from=2026-01-01T00:00:00.000Z&date_to=2026-01-10T00:00:00.000Z")
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      const buf = res.body as Buffer;
      expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    });

    it("200 json preview when format=json", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl?period=month&year=2026&month=8&format=json")
        .set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("revenue");
      expect(res.body.data).toHaveProperty("costs");
      expect(res.body.data).toHaveProperty("profit");
    });

    it("alias /pnl works same as /pnl.pdf", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/pnl?period=month&year=2026&month=8")
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
    });
  });

  describe("expenses report", () => {
    it("200 pdf for expenses month", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/expenses.pdf?period=month&year=2026&month=8")
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain('expenses-2026-08.pdf');
      const buf = res.body as Buffer;
      expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    });

    it("200 json preview for expenses", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/expenses?period=month&year=2026&month=8&format=json")
        .set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("totals");
      expect(res.body.data).toHaveProperty("expenses");
    });

    it("400 for invalid category", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/expenses.pdf?period=month&year=2026&month=8&category=INVALID")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
    });
  });

  describe("revenue report", () => {
    it("200 pdf for revenue month", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/revenue.pdf?period=month&year=2026&month=8")
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain('revenue-2026-08.pdf');
      const buf = res.body as Buffer;
      expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    });

    it("200 json preview for revenue custom", async () => {
      const { cookie } = await createSuperAdminUser(app);
      const res = await request(app)
        .get("/api/v1/admin/reports/revenue?period=custom&date_from=2026-01-01T00:00:00.000Z&date_to=2026-02-01T00:00:00.000Z&format=json")
        .set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("series");
    });
  });
});
