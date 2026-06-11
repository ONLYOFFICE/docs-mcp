type DocumentFileUrlOriginPattern =
  | { kind: "any" }
  | { kind: "origin"; origin: string }
  | {
      kind: "domain";
      hostname: string;
      port: string;
      protocol?: "http:" | "https:";
      wildcard: boolean;
    };

function hasUrlProtocol(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

function isSupportedProtocol(protocol: string): protocol is "http:" | "https:" {
  return protocol === "http:" || protocol === "https:";
}

function parseWildcardHostname(hostname: string): {
  hostname: string;
  wildcard: boolean;
} {
  const normalizedHostname = hostname.toLowerCase();

  if (!normalizedHostname.includes("*")) {
    return { hostname: normalizedHostname, wildcard: false };
  }

  if (
    !normalizedHostname.startsWith("*.") ||
    normalizedHostname.slice(2).length === 0 ||
    normalizedHostname.slice(2).includes("*")
  ) {
    throw new Error("Invalid wildcard hostname");
  }

  return {
    hostname: normalizedHostname.slice(2),
    wildcard: true,
  };
}

export function parseDocumentFileUrlOriginPattern(
  value: string,
): DocumentFileUrlOriginPattern {
  const trimmed = value.trim();
  if (trimmed === "*") {
    return { kind: "any" };
  }

  if (hasUrlProtocol(trimmed)) {
    const url = new URL(trimmed);
    if (!isSupportedProtocol(url.protocol)) {
      throw new Error("Unsupported origin protocol");
    }

    const hostname = parseWildcardHostname(url.hostname);
    if (hostname.wildcard) {
      return {
        kind: "domain",
        hostname: hostname.hostname,
        port: url.port,
        protocol: url.protocol,
        wildcard: true,
      };
    }

    return { kind: "origin", origin: url.origin };
  }

  const url = new URL(`http://${trimmed}`);
  if (url.username || url.password || !url.hostname) {
    throw new Error("Invalid domain");
  }

  const hostname = parseWildcardHostname(url.hostname);
  return {
    kind: "domain",
    hostname: hostname.hostname,
    port: url.port,
    wildcard: hostname.wildcard,
  };
}

export function isDocumentFileUrlOriginPattern(value: string): boolean {
  try {
    parseDocumentFileUrlOriginPattern(value);
    return true;
  } catch {
    return false;
  }
}

export function matchesDocumentFileUrlOriginPattern(
  url: URL,
  value: string,
): boolean {
  const pattern = parseDocumentFileUrlOriginPattern(value);

  switch (pattern.kind) {
    case "any":
      return true;
    case "origin":
      return url.origin === pattern.origin;
    case "domain": {
      if (pattern.protocol && url.protocol !== pattern.protocol) {
        return false;
      }

      if (pattern.port && url.port !== pattern.port) {
        return false;
      }

      const hostname = url.hostname.toLowerCase();
      if (!pattern.wildcard) {
        return hostname === pattern.hostname;
      }

      return (
        hostname.endsWith(`.${pattern.hostname}`) &&
        hostname.length > pattern.hostname.length + 1
      );
    }
  }
}
