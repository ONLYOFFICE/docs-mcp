import { realpath, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../config.js";

export type LocalFileAccessError =
  | "invalid_url"
  | "not_configured"
  | "not_found"
  | "outside_allowed_roots";

export type LocalFileAccessResult =
  | { ok: true; filePath: string; size: number }
  | { ok: false; reason: LocalFileAccessError };

let allowedRootsCache: Promise<string[]> | undefined;

function normalizeForCompare(filePath: string): string {
  return process.platform === "win32" ? filePath.toLowerCase() : filePath;
}

function isPathInsideRoot(filePath: string, root: string): boolean {
  const relative = path.relative(root, filePath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function localFileUrlToPath(uri: string): string | null {
  try {
    return fileURLToPath(uri);
  } catch {
    if (!uri.startsWith("file://")) return null;
    const fallbackPath = uri.slice("file://".length);
    return fallbackPath ? fallbackPath : null;
  }
}

async function resolveAllowedRoots(roots: string[]): Promise<string[]> {
  const resolvedRoots = await Promise.all(
    roots.map(async (root) => {
      try {
        return normalizeForCompare(await realpath(path.resolve(root)));
      } catch {
        return null;
      }
    }),
  );

  return resolvedRoots.filter((root): root is string => root !== null);
}

async function getAllowedRoots(
  roots = CONFIG.STDIO_LOCAL_FILE_ALLOWED_ROOTS,
): Promise<string[]> {
  if (roots !== CONFIG.STDIO_LOCAL_FILE_ALLOWED_ROOTS) {
    return resolveAllowedRoots(roots);
  }

  allowedRootsCache ??= resolveAllowedRoots(
    CONFIG.STDIO_LOCAL_FILE_ALLOWED_ROOTS,
  );

  return allowedRootsCache;
}

export async function resolveAllowedLocalFile(
  uri: string,
  allowedRootsConfig = CONFIG.STDIO_LOCAL_FILE_ALLOWED_ROOTS,
): Promise<LocalFileAccessResult> {
  const localPath = localFileUrlToPath(uri);
  if (!localPath) return { ok: false, reason: "invalid_url" };

  const allowedRoots = await getAllowedRoots(allowedRootsConfig);
  if (allowedRoots.length === 0) return { ok: false, reason: "not_configured" };

  let filePath: string;
  try {
    filePath = await realpath(localPath);
  } catch {
    return { ok: false, reason: "not_found" };
  }

  const comparableFilePath = normalizeForCompare(filePath);
  if (
    !allowedRoots.some((root) => isPathInsideRoot(comparableFilePath, root))
  ) {
    return { ok: false, reason: "outside_allowed_roots" };
  }

  try {
    const { size } = await stat(filePath);
    return { ok: true, filePath, size };
  } catch {
    return { ok: false, reason: "not_found" };
  }
}

export function formatLocalFileAccessError(
  uri: string,
  reason: LocalFileAccessError,
): string {
  switch (reason) {
    case "invalid_url":
      return `Invalid local file URL: ${uri}`;
    case "not_configured":
      return "Local file access is not configured. Set STDIO_LOCAL_FILE_ALLOWED_ROOTS to one or more allowed directories.";
    case "not_found":
      return `Local file not found: ${uri}`;
    case "outside_allowed_roots":
      return `Local file is outside the allowed directories: ${uri}`;
  }
}
