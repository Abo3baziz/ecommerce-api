import { EMAIL_BRAND_NAME } from "../../constants/index.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailLayoutInput {
  preheader?: string;
  content: string;
}

export function renderEmailLayout({ preheader = "", content }: EmailLayoutInput): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${EMAIL_BRAND_NAME}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        background-color: #f4f5f7;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1f2933;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      .preheader {
        display: none !important;
        visibility: hidden;
        opacity: 0;
        color: transparent;
        height: 0;
        width: 0;
        max-height: 0;
        max-width: 0;
        overflow: hidden;
      }
      .body-inner {
        padding: 32px 16px;
      }
      .container {
        max-width: 600px;
        width: 100%;
        margin: 0 auto;
      }
      .header {
        padding: 0 0 16px;
        text-align: center;
      }
      .brand {
        font-size: 18px;
        font-weight: 700;
        color: #2563eb;
        text-decoration: none;
        letter-spacing: -0.02em;
      }
      .card {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 40px 32px;
      }
      .eyebrow {
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 12px;
      }
      .h1 {
        text-align: center;
        font-size: 24px;
        line-height: 1.25;
        color: #0f172a;
        margin-bottom: 16px;
        font-weight: 700;
      }
      .p {
        font-size: 15px;
        line-height: 1.6;
        color: #334155;
        margin-bottom: 16px;
      }
      .p-sm {
        font-size: 13px;
        line-height: 1.55;
        color: #64748b;
        margin-bottom: 8px;
      }
      .muted {
        color: #94a3b8;
      }
      .btn-wrap {
        margin: 24px 0;
      }
      .btn {
        display: inline-block;
        padding: 14px 32px;
        border-radius: 8px;
        background-color: #2563eb;
        color: #ffffff !important;
        font-size: 15px;
        font-weight: 600;
        text-decoration: none;
        letter-spacing: 0.01em;
      }
      .divider {
        border: none;
        border-top: 1px solid #e2e8f0;
        margin: 24px 0;
      }
      .link {
        font-size: 13px;
        line-height: 1.5;
        color: #2563eb;
        word-break: break-all;
        margin-bottom: 16px;
      }
      .footer {
        padding: 20px 8px 0;
        text-align: center;
      }
      .footer p {
        font-size: 12px;
        line-height: 1.6;
        color: #94a3b8;
        margin-bottom: 4px;
      }
      @media only screen and (max-width: 480px) {
        .body-inner {
          padding: 16px 8px;
        }
        .card {
          padding: 32px 24px;
        }
        .btn {
          display: block;
          text-align: center;
        }
      }
    </style>
  </head>
  <body>
    <span class="preheader">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="body-inner" align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="container">
            <tr>
              <td class="header">
                <a href="#" class="brand">${EMAIL_BRAND_NAME}</a>
              </td>
            </tr>
            <tr>
              <td class="card">
                ${content}
              </td>
            </tr>
            <tr>
              <td class="footer">
                <p>You received this email because an account was created with this address on ${EMAIL_BRAND_NAME}.</p>
                <p>If this wasn't you, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function emailEyebrow(text: string): string {
  return `<p class="eyebrow">${text}</p>`;
}

export function emailHeading(text: string): string {
  return `<h1 class="h1">${text}</h1>`;
}

export function emailText(text: string): string {
  return `<p class="p">${text}</p>`;
}

export function emailSmallText(text: string, muted = false): string {
  return `<p class="p-sm${muted ? " muted" : ""}">${text}</p>`;
}

export function emailButton(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="btn-wrap"><tr><td align="center"><a href="${href}" class="btn">${label}</a></td></tr></table>`;
}

export function emailDivider(): string {
  return `<hr class="divider" />`;
}

export function emailTextLink(text: string, href: string): string {
  return `<a href="${href}" style="color: #2563eb; text-decoration: underline;">${text}</a>`;
}
