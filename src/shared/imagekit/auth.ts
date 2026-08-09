import { imagekit } from "./client.js";

export interface UploadAuthenticationParameters {
  token: string;
  expire: number;
  signature: string;
}

export function getUploadAuthenticationParameters(): UploadAuthenticationParameters {
  return imagekit.helper.getAuthenticationParameters();
}
