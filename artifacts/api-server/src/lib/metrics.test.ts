import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from "./metrics";

describe("metrics", () => {
  beforeEach(() => {
    // Reset custom metric values between tests (does NOT reset default Node metrics).
    httpRequestsTotal.reset();
    httpRequestDurationSeconds.reset();
  });

  it("increments http_requests_total on a matched request", async () => {
    await request(app).get("/api/healthz").expect(200);
    const metric = await httpRequestsTotal.get();
    const matched = metric.values.find(
      (v) =>
        v.labels.method === "GET" &&
        v.labels.route === "/api/healthz" &&
        v.labels.status === "200",
    );
    expect(matched).toBeDefined();
    expect(matched?.value).toBe(1);
  });

  it("observes http_request_duration_seconds on a matched request", async () => {
    await request(app).get("/api/healthz").expect(200);
    const metric = await httpRequestDurationSeconds.get();
    const matched = metric.values.find(
      (v) =>
        v.metricName === "http_request_duration_seconds_count" &&
        v.labels.method === "GET" &&
        v.labels.route === "/api/healthz",
    );
    expect(matched).toBeDefined();
    expect(matched?.value).toBeGreaterThanOrEqual(1);
  });

  it("returns Prometheus text format at GET /api/metrics", async () => {
    await request(app).get("/api/healthz");
    const response = await request(app).get("/api/metrics");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("# HELP http_requests_total");
    expect(response.text).toContain("# TYPE http_requests_total counter");
    expect(response.text).toContain("# HELP ai_tokens_total");
    expect(response.text).toContain("process_cpu_seconds_total");
  });
});
