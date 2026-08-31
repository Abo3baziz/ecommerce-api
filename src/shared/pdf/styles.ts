export const PALETTE = {
  primary: "#111827",
  secondary: "#6B7280",
  muted: "#9CA3AF",
  accent: "#2563EB",
  accentLight: "#DBEAFE",
  success: "#059669",
  danger: "#DC2626",
  border: "#E5E7EB",
  rowAlt: "#F9FAFB",
  headerBg: "#1E293B",
  white: "#FFFFFF",
} as const;

export const FONT_SIZE = {
  xs: 7,
  sm: 8,
  body: 9,
  label: 10,
  h3: 11,
  h2: 13,
  h1: 18,
} as const;

export const PAGE = {
  margin: 36,
  width: 595.28, // A4
  height: 841.89,
  usableWidth: 595.28 - 36 * 2, // 523.28
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;
