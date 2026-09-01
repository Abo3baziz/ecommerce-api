export const SETTINGS_KEYS = [
  "general",
  "commerce",
  "payment",
  "shipping",
  "email",
  "customer",
  "security",
  "admin_permissions",
  "financial",
] as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[number];

export interface SystemSettingRecord {
  key: SettingsKey;
  value: unknown;
  updated_at: Date;
  updated_by: number | null;
}

export interface GetSettingsResult {
  key: SettingsKey;
  value: unknown;
  updated_at: string;
  updated_by: number | null;
}

export const MASKED_SENTINEL = "[redacted]";
export const PRESERVE_SENTINEL = "__REDACTED__";
