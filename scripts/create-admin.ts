import { resolve } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/database.js";
import { user_role } from "../src/generated/prisma/enums.js";
import { logger } from "../src/shared/logger/index.js";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export type PromoteToAdminResult =
  | { status: "not_found" }
  | { status: "already_admin"; role: user_role }
  | { status: "promoted"; previousRole: user_role };

export interface AdminCreateOutcome {
  exitCode: number;
  messages: string[];
}

export async function promoteUserToAdmin(
  email: string,
): Promise<PromoteToAdminResult> {
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!user) {
    return { status: "not_found" };
  }

  if (user.role === user_role.ADMIN) {
    return { status: "already_admin", role: user.role };
  }

  await prisma.users.update({
    where: { id: user.id },
    data: { role: user_role.ADMIN, updated_at: new Date() },
    select: { id: true },
  });

  return { status: "promoted", previousRole: user.role };
}

export async function runAdminCreate(email: string): Promise<AdminCreateOutcome> {
  const trimmed = email.trim();

  if (!trimmed) {
    return { exitCode: 1, messages: ["Error: email is required."] };
  }

  if (!EMAIL_PATTERN.test(trimmed)) {
    return {
      exitCode: 1,
      messages: ["Error: invalid email format.", "No changes were made."],
    };
  }

  try {
    const result = await promoteUserToAdmin(trimmed);

    switch (result.status) {
      case "not_found":
        return {
          exitCode: 1,
          messages: [
            "No user found with the provided email.",
            "No changes were made.",
          ],
        };
      case "already_admin":
        return {
          exitCode: 0,
          messages: ["User is already an ADMIN.", "No changes were made."],
        };
      case "promoted":
        return {
          exitCode: 0,
          messages: [
            "User found.",
            `Current role: ${result.previousRole}`,
            "",
            "Promoting user to ADMIN...",
            "",
            "User successfully promoted to ADMIN.",
          ],
        };
    }
  } catch (error) {
    logger.error({ err: error }, "Admin bootstrap failed");

    return {
      exitCode: 1,
      messages: [
        "An error occurred while promoting the user.",
        "No changes were made.",
      ],
    };
  }
}

async function main(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question("Admin email: ");
    const outcome = await runAdminCreate(answer);

    for (const message of outcome.messages) {
      console.log(message);
    }

    process.exitCode = outcome.exitCode;
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((error: unknown) => {
    logger.error({ err: error }, "Admin bootstrap CLI failed");

    console.error("An unexpected error occurred.");
    process.exitCode = 1;
  });
}
