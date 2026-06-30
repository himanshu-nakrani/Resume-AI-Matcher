import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

/**
 * Single Registry holds all metrics. Tests can reset state with
 * `registry.resetMetrics()` (does not affect default Node metrics).
 */
export const registry = new Registry();

// Default Node.js process metrics (CPU, memory, event-loop lag, GC, handles).
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests, labeled by method, route, status",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const aiTokensTotal = new Counter({
  name: "ai_tokens_total",
  help: "Total AI tokens consumed, labeled by model, route, outcome",
  labelNames: ["model", "route", "outcome"] as const,
  registers: [registry],
});
