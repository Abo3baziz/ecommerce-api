import { describe, it, expect } from "vitest";
import { parseDeviceName } from "../../../src/modules/auth/utils/userAgent.js";

describe("parseDeviceName", () => {
  it("returns null when the user agent is missing", () => {
    expect(parseDeviceName(undefined)).toBeNull();
    expect(parseDeviceName(null)).toBeNull();
    expect(parseDeviceName("")).toBeNull();
  });

  it("combines the browser and OS", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    expect(parseDeviceName(ua)).toBe("Chrome on Windows");
  });

  it("detects Safari on iOS", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    expect(parseDeviceName(ua)).toBe("Safari on iOS");
  });

  it("detects Firefox on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/127.0 Gecko/20100101 Firefox/127.0";
    expect(parseDeviceName(ua)).toBe("Firefox on macOS");
  });

  it("detects Edge on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
    expect(parseDeviceName(ua)).toBe("Edge on Windows");
  });

  it("returns the browser only when the OS is unknown", () => {
    const ua =
      "Mozilla/5.0 (X11; FooBar) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    expect(parseDeviceName(ua)).toBe("Chrome");
  });

  it("truncates long unknown user agents", () => {
    const long = "x".repeat(200);
    expect(parseDeviceName(long)).toBe(`${long.slice(0, 97)}...`);
  });
});
