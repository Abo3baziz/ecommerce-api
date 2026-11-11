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
      /**
       * Set by middleware/demoMode.ts when the request is an unauthenticated
       * read admitted through public demo mode. Only set for safe methods
       * (GET/HEAD) while ENABLE_DEMO_MODE is on; authentication consumes it
       * to admit the visitor with the synthetic demo principal.
       */
      isDemoPublicRead?: boolean;
    }
  }
}

export {};
