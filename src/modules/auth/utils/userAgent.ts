export function parseDeviceName(userAgent?: string | null): string | null {
  if (!userAgent) {
    return null;
  }

  const browser = detectBrowser(userAgent);
  const os = detectOs(userAgent);

  if (browser && os) {
    return `${browser} on ${os}`;
  }
  if (browser) {
    return browser;
  }
  if (os) {
    return os;
  }
  return userAgent.length > 100 ? `${userAgent.slice(0, 97)}...` : userAgent;
}

function detectBrowser(userAgent: string): string | null {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/OPR\/|Opera/i.test(userAgent)) return "Opera";
  if (/SamsungBrowser/i.test(userAgent)) return "Samsung Internet";
  if (/Chrome\//i.test(userAgent)) return "Chrome";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Trident|MSIE/i.test(userAgent)) return "Internet Explorer";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return null;
}

function detectOs(userAgent: string): string | null {
  if (/Windows NT/i.test(userAgent)) return "Windows";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Mac OS X/i.test(userAgent)) return "macOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Linux/i.test(userAgent)) return "Linux";
  return null;
}
