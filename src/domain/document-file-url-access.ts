import { CONFIG } from "../config.js";

export type DocumentFileUrlAccessError =
  | "invalid_url"
  | "not_configured"
  | "unsupported_protocol"
  | "outside_allowed_origins";

type DocumentFileUrlAccessResult =
  | { ok: true }
  | { ok: false; reason: DocumentFileUrlAccessError; origin?: string };

function normalizeOrigin(origin: string): string {
  return new URL(origin).origin;
}

export function validateAllowedDocumentFileUrl(
  url: string,
  allowedOriginsConfig = CONFIG.FILE_URL_ALLOWED_ORIGINS,
): DocumentFileUrlAccessResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "unsupported_protocol", origin: parsed.origin };
  }

  if (allowedOriginsConfig.length === 0) {
    return { ok: false, reason: "not_configured", origin: parsed.origin };
  }

  if (allowedOriginsConfig.includes("*")) {
    return { ok: true };
  }

  const allowedOrigins = new Set(allowedOriginsConfig.map((origin) => normalizeOrigin(origin)));
  if (!allowedOrigins.has(parsed.origin)) {
    return { ok: false, reason: "outside_allowed_origins", origin: parsed.origin };
  }

  return { ok: true };
}

export function formatDocumentFileUrlAccessError(url: string, error: DocumentFileUrlAccessResult): string {
  if (error.ok) return "";

  switch (error.reason) {
    case "invalid_url":
      return `Invalid document file URL: ${url}`;
    case "not_configured":
      return "Remote document file URL access is not configured. Set FILE_URL_ALLOWED_ORIGINS to one or more allowed origins.";
    case "unsupported_protocol":
      return `Document file URL must use http or https: ${url}`;
    case "outside_allowed_origins":
      return `Document file URL origin is not allowed: ${error.origin ?? url}`;
  }
}
