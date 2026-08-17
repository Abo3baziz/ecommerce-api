import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { registerUser, csrfHeaders } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { randomPhoneNumber } from "../../helpers/random.js";

const BASE_URL = "/api/v1/users/me/addresses";

function addressPayload(overrides: Record<string, unknown> = {}) {
  return {
    recipient_name: "Ahmed Aziz",
    phone_number: randomPhoneNumber(),
    label: "Home",
    country: "Egypt",
    state: "Cairo",
    city: "Cairo",
    address_1: "12 Test Street",
    address_2: null,
    zip_code: "11511",
    ...overrides,
  };
}

describe("addresses API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/v1/users/me/addresses", () => {
    it("rejects a request without authentication (401)", async () => {
      const response = await request(app).get(BASE_URL);

      expect(response.status).toBe(401);
    });

    it("returns an empty list with pagination metadata (200)", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get(BASE_URL)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("lists addresses with pagination metadata (200)", async () => {
      const { cookie, csrf } = await registerUser(app);
      for (let index = 0; index < 3; index += 1) {
        await request(app)
          .post(BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send(addressPayload());
      }

      const response = await request(app)
        .get(`${BASE_URL}?page=2&limit=2`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      });
    });
  });

  describe("POST /api/v1/users/me/addresses", () => {
    it("creates an address as default when it is the first one (201)", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(addressPayload());

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toMatch(/^adr_/);
      expect(response.body.data.is_default_shipping).toBe(true);
      expect(response.body.data.is_default_billing).toBe(true);
      expect(response.body.data).not.toHaveProperty("id");
    });

    it("does not default a subsequent address (201)", async () => {
      const { cookie, csrf } = await registerUser(app);
      await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(addressPayload());

      const response = await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(addressPayload());

      expect(response.status).toBe(201);
      expect(response.body.data.is_default_shipping).toBe(false);
      expect(response.body.data.is_default_billing).toBe(false);
    });

    it("rejects an invalid payload (400)", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ recipient_name: "" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation error");
    });
  });

  describe("GET /api/v1/users/me/addresses/:address_public_id", () => {
    it("returns an owned address (200)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const created = await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(addressPayload());

      const response = await request(app)
        .get(`${BASE_URL}/${created.body.data.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toBe(created.body.data.public_id);
    });

    it("returns 404 for an unknown address", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get(`${BASE_URL}/adr_${nanoid(10)}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 for an address owned by another user", async () => {
      const owner = await registerUser(app);
      const other = await registerUser(app);
      const created = await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(owner.cookie!, owner.csrf!))
        .send(addressPayload());

      const response = await request(app)
        .get(`${BASE_URL}/${created.body.data.public_id}`)
        .set("Cookie", other.cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/users/me/addresses/:address_public_id", () => {
    it("updates an owned address (200)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const created = await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(addressPayload());

      const response = await request(app)
        .patch(`${BASE_URL}/${created.body.data.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ recipient_name: "Omar Hassan", city: "Giza" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recipient_name).toBe("Omar Hassan");
      expect(response.body.data.city).toBe("Giza");
    });

    it("returns 404 for an address owned by another user", async () => {
      const owner = await registerUser(app);
      const other = await registerUser(app);
      const created = await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(owner.cookie!, owner.csrf!))
        .send(addressPayload());

      const response = await request(app)
        .patch(`${BASE_URL}/${created.body.data.public_id}`)
        .set(csrfHeaders(other.cookie!, other.csrf!))
        .send({ recipient_name: "Omar" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/users/me/addresses/:address_public_id", () => {
    it("deletes an owned address (204) and hides it afterwards", async () => {
      const { cookie, csrf } = await registerUser(app);
      const created = await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(addressPayload());

      const response = await request(app)
        .delete(`${BASE_URL}/${created.body.data.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(204);

      const getResponse = await request(app)
        .get(`${BASE_URL}/${created.body.data.public_id}`)
        .set("Cookie", cookie!);
      expect(getResponse.status).toBe(404);
    });

    it("returns 404 for an address owned by another user", async () => {
      const owner = await registerUser(app);
      const other = await registerUser(app);
      const created = await request(app)
        .post(BASE_URL)
        .set(csrfHeaders(owner.cookie!, owner.csrf!))
        .send(addressPayload());

      const response = await request(app)
        .delete(`${BASE_URL}/${created.body.data.public_id}`)
        .set(csrfHeaders(other.cookie!, other.csrf!))

      expect(response.status).toBe(404);
    });
  });
});
