import { Request, Response, NextFunction } from "express";
import { getSettings, updateSettings, sendTestEmail } from "../service/settings.service.js";
import type { GetSettingsQuery } from "../validators/admin.js";

export async function getSettingsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { section } = req.query as GetSettingsQuery;
    const data = await getSettings(section);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function patchSettingsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { section } = req.params as { section: string };
    const actor = req.user as { id: number; public_id: string };
    if (!actor?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const ip = (req.ip as string) ?? null;
    const userAgent = (req.get("user-agent") as string) ?? null;
    const data = await updateSettings(section, req.body, actor, { ip, userAgent });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function testEmailController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to } = req.body as { to: string };
    const actor = req.user as { id: number };
    if (!actor?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const ip = (req.ip as string) ?? null;
    const userAgent = (req.get("user-agent") as string) ?? null;
    const data = await sendTestEmail(to, actor, { ip, userAgent });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
