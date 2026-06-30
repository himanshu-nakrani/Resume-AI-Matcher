import type { Request, Response, NextFunction } from "express";
import { httpRequestsTotal, httpRequestDurationSeconds } from "../lib/metrics";

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    // Express populates req.route only AFTER a route handler matches.
    // Fall back to "unmatched" to keep label cardinality bounded.
    const routePath = (req.route?.path as string | undefined) ?? "unmatched";
    // The api router is mounted at /api, so prefix to make full path explicit.
    const route = routePath === "unmatched" ? "unmatched" : `/api${routePath}`;
    const method = req.method;
    const status = String(res.statusCode);

    httpRequestsTotal.inc({ method, route, status });

    const durationNs = Number(process.hrtime.bigint() - start);
    httpRequestDurationSeconds.observe({ method, route }, durationNs / 1e9);
  });

  next();
}
