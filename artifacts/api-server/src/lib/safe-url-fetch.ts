import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeUrlError extends Error {
  constructor(message = "URL is not allowed") {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export class ResponseTooLargeError extends Error {
  constructor(message = "Response body is too large") {
    super(message);
    this.name = "ResponseTooLargeError";
  }
}

type FetchReadableTextOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
};

const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 3;

function parseIPv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : Number.NaN;
  });

  return octets.every(Number.isInteger) ? octets : null;
}

function isUnsafeIPv4(address: string): boolean {
  const octets = parseIPv4(address);
  if (!octets) return true;

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isUnsafeIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isUnsafeIPv4(mapped[1]!);

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

function assertSafeAddress(address: string): void {
  const version = isIP(address);
  if (version === 4 && isUnsafeIPv4(address)) {
    throw new UnsafeUrlError("URL resolves to a private or reserved IPv4 address");
  }
  if (version === 6 && isUnsafeIPv6(address)) {
    throw new UnsafeUrlError("URL resolves to a private or reserved IPv6 address");
  }
  if (version === 0) {
    throw new UnsafeUrlError("URL resolves to an invalid IP address");
  }
}

async function assertSafeUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTP and HTTPS URLs are allowed");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new UnsafeUrlError("Local hostnames are not allowed");
  }

  if (isIP(hostname)) {
    assertSafeAddress(hostname);
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new UnsafeUrlError("URL hostname could not be resolved");
  }

  for (const address of addresses) {
    assertSafeAddress(address.address);
  }
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ResponseTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total).toString("utf8");
}

export function htmlToReadableText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

export async function fetchReadableTextFromUrl(
  input: string,
  options: FetchReadableTextOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let url = new URL(input);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertSafeUrl(url);

    const response = await fetch(url, {
      headers: options.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new UnsafeUrlError("Redirect response did not include a location");
      }
      if (redirectCount === maxRedirects) {
        throw new UnsafeUrlError("Too many redirects");
      }
      url = new URL(location, url);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    return htmlToReadableText(await readTextWithLimit(response, maxBytes));
  }

  throw new UnsafeUrlError("Too many redirects");
}
