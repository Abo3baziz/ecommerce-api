import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";
import { hashToken } from "../../src/modules/auth/utils/tokens.js";
import { verification_type } from "../../src/generated/prisma/enums.js";

export interface CreateVerificationTokenParams {
  usersId: number;
  rawToken: string;
  purpose: verification_type;
  target: string;
  expiresAt: Date;
  usedAt?: Date | null;
  verifiedAt?: Date | null;
}

export async function createVerificationToken(params: CreateVerificationTokenParams) {
  return prisma.verification_tokens.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.VERIFICATION),
      token_hash: hashToken(params.rawToken),
      target: params.target,
      purpose: params.purpose,
      users_id: params.usersId,
      expires_at: params.expiresAt,
      used_at: params.usedAt ?? null,
      verified_at: params.verifiedAt ?? null,
      created_at: new Date(),
    },
  });
}
