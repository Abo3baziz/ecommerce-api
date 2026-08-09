import ImageKit from "@imagekit/nodejs";
import { env } from "../../config/env.js";

export const imagekit = new ImageKit({
  privateKey: env.IMAGEKIT_PRIVATE_KEY,
});
