import { resolve } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/database.js";
import { user_role } from "../src/generated/prisma/enums.js";
import { recordAuditEventInTx } from "../src/modules/audit/service/audit.service.js";
import { logger } from "../src/shared/logger/index.js";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const CONFIRMATION_WORD = "TRANSFER";

export type TransferSuperAdminResult =
  | { status: "missing_current" }
  | { status: "missing_successor" }
  | { status: "same_user" }
  | { status: "current_not_super_admin"; currentRole: user_role }
  | { status: "successor_is_super_admin" }
  | { status: "transferred" };

export interface TransferOutcome {
  exitCode: number;
  messages: string[];
}

/**
 * Atomically moves the single SUPER_ADMIN role from one account to another.
 * Both updates commit together, so there is never a moment with zero super
 * admins. Never prints secrets; only emails and roles are reported.
 */
export async function transferSuperAdmin(
  currentEmail: string,
  successorEmail: string,
): Promise<TransferSuperAdminResult> {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.users.findUnique({
      where: { email: currentEmail },
      select: { id: true, public_id: true, role: true },
    });

    if (!current || current.role !== user_role.SUPER_ADMIN) {
      return {
        status: "current_not_super_admin",
        currentRole: current?.role ?? user_role.CUSTOMER,
      } as const;
    }

    const successor = await tx.users.findUnique({
      where: { email: successorEmail },
      select: { id: true, role: true },
    });

    if (!successor) {
      return { status: "missing_successor" } as const;
    }

    if (successor.id === current.id) {
      return { status: "same_user" } as const;
    }

    if (successor.role === user_role.SUPER_ADMIN) {
      return { status: "successor_is_super_admin" } as const;
    }

    await tx.users.update({
      where: { id: successor.id },
      data: { role: user_role.SUPER_ADMIN, updated_at: new Date() },
    });
    await tx.users.update({
      where: { id: current.id },
      data: { role: user_role.ADMIN, updated_at: new Date() },
    });

    // Transactional audit: a transfer without its record rolls back.
    await recordAuditEventInTx(tx, {
      actorUsersId: current.id,
      action: "auth.super_admin.transferred",
      entityType: "user",
      entityPublicId: successor.email,
      statusCode: 200,
      requestBody: { from_email: currentEmail, to_email: successorEmail },
    });

    return { status: "transferred" } as const;
  });

  return result;
}

function describeOutcome(result: TransferSuperAdminResult): TransferOutcome {
  switch (result.status) {
    case "current_not_super_admin":
      return {
        exitCode: 1,
        messages: [
          `The provided current email is not a SUPER_ADMIN (role: ${result.currentRole}).`,
          "No changes were made.",
        ],
      };
    case "missing_successor":
      return {
        exitCode: 1,
        messages: [
          "No user found with the successor email.",
          "No changes were made.",
        ],
      };
    case "same_user":
      return {
        exitCode: 1,
        messages: [
          "Current and successor emails belong to the same user.",
          "No changes were made.",
        ],
      };
    case "successor_is_super_admin":
      return {
        exitCode: 1,
        messages: [
          "The successor is already a SUPER_ADMIN.",
          "No changes were made.",
        ],
      };
    default:
      return {
        exitCode: 0,
        messages: [
          `${CONFIRMATION_WORD} confirmed.`,
          "",
          "Transferring SUPER_ADMIN...",
          "",
          "SUPER_ADMIN successfully transferred.",
          "The previous holder is now an ADMIN.",
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
    const currentEmail = (await rl.question("Current SUPER_ADMIN email: ")).trim();
    const successorEmail = (await rl.question("New SUPER_ADMIN email: ")).trim();
    const confirmation = (
      await rl.question(`Type ${CONFIRMATION_WORD} to confirm: `)
    ).trim();

    if (!EMAIL_PATTERN.test(currentEmail) || !EMAIL_PATTERN.test(successorEmail)) {
      console.log("Error: both values must be valid email addresses.");
      console.log("No changes were made.");
      process.exitCode = 1;
      return;
    }

    let outcome: TransferOutcome;
    if (confirmation === CONFIRMATION_WORD) {
      outcome = describeOutcome(await transferSuperAdmin(currentEmail, successorEmail));
    } else {
      outcome = { exitCode: 1, messages: ["Confirmation not provided.", "No changes were made."] };
    }

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
    logger.error({ err: error }, "SUPER_ADMIN transfer CLI failed");
    console.error("An unexpected error occurred.");
    process.exitCode = 1;
  });
}
