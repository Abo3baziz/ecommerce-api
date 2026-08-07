import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;
const connectionUrl = new URL(connectionString);
const schema = connectionUrl.searchParams.get("schema") ?? "public";

const adapter = new PrismaPg(
  { connectionString, options: "-c timezone=UTC" },
  { schema },
);
const prisma = new PrismaClient({ adapter });

export { prisma };
