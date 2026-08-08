import dotenv from "dotenv";

dotenv.config({ path: ".env.test", override: false });
process.env.NODE_ENV = "test";
