import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../src/app/index.js";
import { registerUser } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { prisma } from "../../../src/config/database.js";
import { SESSION_IDLE_TIMEOUT_MS } from "../../../src/shared/constants/session.js";

const SESSION_URL = "/api/v1/auth/session";

describe("session idle timeout", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("rejects a request when the session has been idle beyond the window (401)", async () => {
    const { cookie } = await registerUser(app);

    await prisma.sessions.updateMany({
      data: {
        last_activity_at: new Date(
          Date.now() - SESSION_IDLE_TIMEOUT_MS - 60_000,
        ),
      },
    });

    const response = await request(app).get(SESSION_URL).set("Cookie", cookie!);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Session has been inactive for too long",
    );
  });

  it("keeps a session valid with activity inside the idle window", async () => {
    const { cookie } = await registerUser(app);

    await prisma.sessions.updateMany({
      data: {
        last_activity_at: new Date(
          Date.now() - (SESSION_IDLE_TIMEOUT_MS - 60_000),
        ),
      },
    });

    const response = await request(app).get(SESSION_URL).set("Cookie", cookie!);

    expect(response.status).toBe(200);
    expect(response.body.data.authenticated).toBe(true);
  });

  it("slides last_activity_at forward on an authenticated request", async () => {
    const { cookie } = await registerUser(app);
    const session = await prisma.sessions.findFirst();
    const before = session!.last_activity_at!.getTime();

    await new Promise((resolve) => setTimeout(resolve, 5));

    const response = await request(app).get(SESSION_URL).set("Cookie", cookie!);

    expect(response.status).toBe(200);

    const after = await prisma.sessions.findUnique({
      where: { id: session!.id },
    });
    expect(after!.last_activity_at!.getTime()).toBeGreaterThan(before);
  });

  it("rejects a session with no recorded last activity (401)", async () => {
    const { cookie } = await registerUser(app);

    await prisma.sessions.updateMany({ data: { last_activity_at: null } });

    const response = await request(app).get(SESSION_URL).set("Cookie", cookie!);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe(
      "Session has been inactive for too long",
    );
  });
});
