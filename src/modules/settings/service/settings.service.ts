import { prisma } from "../../../config/database.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../shared/logger/index.js";
import { sendEmail } from "../../../shared/mailer/index.js";
import { recordAuditEvent, recordAuditEventInTx } from "../../audit/service/audit.service.js";
import { settingsRepository, type SystemSettingsRow } from "../repository/settings.repository.js";
import { maskSecrets, redactValue, buildRedactedChanges } from "../utils/redact.js";
import { encryptSecret } from "../utils/encryption.js";
import { getPatchSchema, SETTINGS_KEYS, type SettingsKey } from "../validators/admin.js";
import { MASKED_SENTINEL, PRESERVE_SENTINEL } from "../dto/settings.js";

// Expose only the actor's public_id — internal users.id must never leak.
function toSettingsResult(row: SystemSettingsRow): {
  key: SettingsKey;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
} {
  return {
    key: row.key as SettingsKey,
    value: maskSecrets(row.value as Record<string, unknown>),
    updated_at: (row.updated_at as Date).toISOString(),
    updated_by: row.users?.public_id ?? null,
  };
}

function encryptSecretsInValue(section: string, value: Record<string, unknown>, prevEncrypted?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  const secretFields = ["provider_secret_key", "webhook_secret", "smtp_password"];

  for (const field of secretFields) {
    if (field in out) {
      const incoming = out[field] as string | undefined;
      if (incoming === PRESERVE_SENTINEL || incoming === MASKED_SENTINEL) {
        // preserve previous encrypted value
        if (prevEncrypted && prevEncrypted[field] !== undefined) {
          out[field] = prevEncrypted[field];
        } else {
          out[field] = prevEncrypted?.[field] ?? MASKED_SENTINEL;
        }
      } else if (typeof incoming === "string" && incoming !== "" && incoming !== MASKED_SENTINEL && incoming !== PRESERVE_SENTINEL) {
        out[field] = encryptSecret(incoming);
      } else if (incoming === "" || incoming === undefined) {
        // allow clearing?
        out[field] = incoming ?? undefined;
      }
    }
  }

  // Also encrypt inside provider_config if it contains secrets
  if (out.provider_config && typeof out.provider_config === "object") {
    const pc = { ...(out.provider_config as Record<string, unknown>) };
    let changed = false;
    for (const [k, v] of Object.entries(pc)) {
      if (k.toLowerCase().includes("secret") || k.toLowerCase().includes("password") || k.toLowerCase().includes("api_key")) {
        if (typeof v === "string" && v !== "" && v !== PRESERVE_SENTINEL && v !== MASKED_SENTINEL) {
          pc[k] = encryptSecret(v);
          changed = true;
        } else if ((v === PRESERVE_SENTINEL || v === MASKED_SENTINEL) && prevEncrypted?.provider_config) {
          const prevPc = prevEncrypted.provider_config as Record<string, unknown>;
          if (prevPc && prevPc[k] !== undefined) {
            pc[k] = prevPc[k];
            changed = true;
          } else {
            pc[k] = MASKED_SENTINEL;
            changed = true;
          }
        } else if (v === MASKED_SENTINEL || v === PRESERVE_SENTINEL) {
          // no previous, keep sentinel masked
          pc[k] = MASKED_SENTINEL;
          changed = true;
        }
      }
    }
    if (changed) out.provider_config = pc;
  }

  return out;
}

export async function getSettings(section?: string) {
  if (section) {
    if (!SETTINGS_KEYS.includes(section as SettingsKey)) throw new BadRequestError("Invalid section");
    const row = await settingsRepository.findByKey(section);
    if (!row) throw new NotFoundError("Settings section not found");
    return toSettingsResult(row);
  }
  const rows = await settingsRepository.findMany();
  return rows.map(toSettingsResult);
}

export async function getSettingsRaw(section: string) {
  const row = await settingsRepository.findByKey(section);
  if (!row) throw new NotFoundError("Settings section not found");
  // decrypt secrets for internal use (not masked)
  // We don't decrypt here; caller decides
  return row;
}

export async function updateSettings(
  section: string,
  input: unknown,
  actor: { id: number; public_id: string },
  ctx: { ip: string | null; userAgent: string | null },
) {
  const schema = getPatchSchema(section);
  if (!schema) throw new BadRequestError("Invalid section");

  // Validate input via schema body shape (we already validated in middleware, but double-check)
  // input is req.body, schema expects {params, body} so we parse body alone
  // Instead we rely on already validated req.body

  const prevRow = await settingsRepository.findByKey(section);
  const prevValue = (prevRow?.value as Record<string, unknown>) ?? {};

  const encryptedValue = encryptSecretsInValue(section, input as Record<string, unknown>, prevValue);

  const redactedInput = redactValue(input);
  const redactedPrev = redactValue(prevValue);
  // Inputs are already redacted, so secrets can never reach the audit row.
  const changes = buildRedactedChanges(redactedPrev, redactedInput);

  const result = await prisma.$transaction(async (tx) => {
    const next = await settingsRepository.upsert(section, { value: encryptedValue as never, updated_by: actor.id }, tx as never);
    await recordAuditEventInTx(tx as never, {
      action: `admin.settings.${section}_update`,
      entityType: "system_settings",
      entityPublicId: section,
      actorUsersId: actor.id,
      method: "PATCH",
      path: `/api/v1/admin/settings/${section}`,
      statusCode: 200,
      requestBody: redactedInput as never,
      previousValues: redactedPrev as never,
      changes: changes as never,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return next;
  });

  // Return masked
  return toSettingsResult(result);
}

const TEST_EMAIL_SUBJECT = "Test email — Ecommerce system settings";

function renderTestEmailHtml(senderName: string, to: string): string {
  const safeName = senderName.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const safeTo = to.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return [
    "<!doctype html><html><body style=\"font-family:Arial,Helvetica,sans-serif;margin:0;padding:24px;background:#f6f6f6\">",
    "<div style=\"max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;padding:24px\">",
    `<h1 style=\"font-size:18px;margin:0 0 8px\">${safeName} — test email</h1>`,
    `<p style=\"font-size:14px;color:#444;margin:0 0 16px\">This is a test message sent from the system settings console to <strong>${safeTo}</strong>.</p>`,
    "<p style=\"font-size:12px;color:#888;margin:0\">If you received this message, the configured email channel is working.</p>",
    "</div></body></html>",
  ].join("");
}

/**
 * Sends a test email through the configured email channel to verify
 * deliverability. Uses the persisted sender identity from the email section
 * (falling back to the environment defaults) and records one audit row.
 */
export async function sendTestEmail(
  to: string,
  actor: { id: number },
  ctx: { ip: string | null; userAgent: string | null },
): Promise<{ sent_to: string }> {
  const emailRow = await settingsRepository.findByKey("email");
  const emailValue = (emailRow?.value as Record<string, unknown>) ?? {};
  const senderName =
    typeof emailValue.sender_name === "string" && emailValue.sender_name ? emailValue.sender_name : "Ecommerce Store";
  const senderEmail =
    typeof emailValue.sender_email === "string" && emailValue.sender_email ? emailValue.sender_email : env.RESEND_FROM_EMAIL;

  try {
    await sendEmail({
      to,
      subject: TEST_EMAIL_SUBJECT,
      html: renderTestEmailHtml(senderName, to),
      from: `${senderName} <${senderEmail}>`,
    });
  } catch (error) {
    // Provider errors may contain account details — log context server-side,
    // surface a clean operational error to the client.
    logger.warn({ err: error, to }, "Test email delivery failed");
    throw new AppError("Email delivery failed. Check the email provider configuration.", 502);
  }

  await recordAuditEvent({
    action: "admin.settings.email_test",
    entityType: "system_settings",
    entityPublicId: "email",
    actorUsersId: actor.id,
    method: "POST",
    path: "/api/v1/admin/settings/email/test",
    statusCode: 200,
    requestBody: { to },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { sent_to: to };
}

// For maintenance middleware
export async function getGeneralSettingsValue(): Promise<Record<string, unknown> | null> {
  const row = await settingsRepository.findByKey("general");
  if (!row) return null;
  return row.value as Record<string, unknown>;
}
