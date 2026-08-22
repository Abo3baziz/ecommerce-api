import { z } from "zod";

export const STATS_PERIOD_PRESETS = ["today", "7d", "30d"] as const;

export type StatsPeriodPreset = (typeof STATS_PERIOD_PRESETS)[number];

export const getAdminStatsSchema = z.object({
  query: z.object({
    period: z.enum(STATS_PERIOD_PRESETS).default("7d"),
  }),
});

export type GetAdminStatsQuery = z.infer<
  typeof getAdminStatsSchema.shape.query
>;
