import { nanoid } from "nanoid";
import { env } from "../../src/config/env.js";

export function imageKitImageUrl(path: string = `${nanoid(6)}.jpg`): string {
  return `${env.IMAGEKIT_URL_ENDPOINT}/${path}`;
}
