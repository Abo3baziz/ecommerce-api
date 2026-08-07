export interface SessionInfo {
  public_id: string;
  current: boolean;
  device: string | null;
  ip_address: string | null;
  last_activity_at: Date | null;
  created_at: Date;
}

export type ListSessionsResult = SessionInfo[];
