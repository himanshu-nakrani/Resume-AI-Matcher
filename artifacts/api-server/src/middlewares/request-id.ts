import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

const HEADER = "x-request-id";
const MAX_LENGTH = 200;

/**
 * Read X-Request-Id from the incoming request; if absent or unreasonable
 * (empty / too long), generate a UUID. Always echo in the response header.
 *
 * Mount this BEFORE pino-http so the pino-http genReqId picks up the
 * already-set req.id.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[HEADER];
  const candidate =
    typeof incoming === "string" && incoming.length > 0 && incoming.length <= MAX_LENGTH
      ? incoming
      : null;
  const id = candidate ?? randomUUID();

  (req as Request & { id: string }).id = id;
  res.setHeader("X-Request-Id", id);

  next();
}
