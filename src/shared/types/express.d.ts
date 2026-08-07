import { users } from "../../generated/prisma/client";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: users;
      authSession?: {
        id: number;
        public_id: string;
        created_at: Date;
        expires_at: Date;
      };
    }
  }
}

export {};
