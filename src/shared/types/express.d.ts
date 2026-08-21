import { users } from "../../generated/prisma/client.js";

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
