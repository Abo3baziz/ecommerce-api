import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env.js";

const connectionUrl = new URL(env.DATABASE_URL);
const schema = connectionUrl.searchParams.get("schema") ?? "public";

const adapter = new PrismaPg(
  { connectionString: env.DATABASE_URL, options: "-c timezone=UTC" },
  { schema },
);

export const prisma = new PrismaClient({ adapter });

export const dbSchema = schema;
