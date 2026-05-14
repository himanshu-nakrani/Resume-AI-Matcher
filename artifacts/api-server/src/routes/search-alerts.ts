import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, searchAlerts } from "@workspace/db";
import { z } from "zod";
import { runExaJobSearch } from "../lib/exa-job-search";
import type { JobSearchFilters } from "../lib/job-search-analyze";

const router: IRouter = Router();

const SearchAlertBody = z.object({
  name: z.string().max(200).optional(),
  query: z.string().min(2).max(2000),
  searchType: z.enum(["auto", "fast", "instant", "deep-lite", "deep", "deep-reasoning"]).optional(),
  userLocation: z.string().max(2).optional(),
  recentOnly: z.boolean().optional(),
  enabled: z.boolean().optional(),
  filters: z.object({
    experienceLevel: z.enum(["entry", "mid", "senior", "lead", "executive"]).optional(),
    jobType: z.enum(["full-time", "contract", "part-time", "internship", "freelance"]).optional(),
    remote: z.enum(["remote", "hybrid", "on-site"]).optional(),
    salaryMin: z.string().optional(),
    industry: z.string().optional(),
    companySize: z.enum(["startup", "mid-size", "enterprise"]).optional(),
  }).optional(),
});

router.get("/search-alerts", async (req, res) => {
  const rows = await db.select().from(searchAlerts).orderBy(desc(searchAlerts.createdAt));
  res.json(rows);
});

router.post("/search-alerts", async (req, res) => {
  const parsed = SearchAlertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(searchAlerts).values({
    name: parsed.data.name ?? undefined,
    query: parsed.data.query,
    searchType: parsed.data.searchType ?? "auto",
    userLocation: parsed.data.userLocation ?? undefined,
    recentOnly: parsed.data.recentOnly ?? false,
    enabled: parsed.data.enabled ?? true,
    filters: parsed.data.filters ?? undefined,
  }).returning();
  res.status(201).json(row);
});

router.delete("/search-alerts/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.delete(searchAlerts).where(eq(searchAlerts.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.patch("/search-alerts/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(searchAlerts).where(eq(searchAlerts.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const body = z.object({
    name: z.string().max(200).optional(),
    enabled: z.boolean().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.enabled !== undefined) updates.enabled = body.data.enabled;

  const [updated] = await db.update(searchAlerts).set(updates).where(eq(searchAlerts.id, id)).returning();
  res.json(updated);
});

router.post("/search-alerts/:id/check", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [alert] = await db.select().from(searchAlerts).where(eq(searchAlerts.id, id));
  if (!alert) { res.status(404).json({ error: "Alert not found" }); return; }

  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) { res.status(503).json({ error: "EXA_API_KEY not configured" }); return; }

  try {
    const data = await runExaJobSearch(apiKey, {
      query: alert.query,
      numResults: 10,
      searchType: (alert.searchType as "auto" | "fast" | "instant" | "deep-lite" | "deep" | "deep-reasoning") ?? "auto",
      userLocation: alert.userLocation ?? undefined,
      recentOnly: alert.recentOnly ?? undefined,
      filters: alert.filters ? (alert.filters as JobSearchFilters) : undefined,
    });

    const previousCount = alert.lastResultCount ?? 0;
    const newCount = data.results.length;

    await db.update(searchAlerts).set({
      lastRunAt: new Date(),
      lastResultCount: newCount,
    }).where(eq(searchAlerts.id, id));

    res.json({
      results: data.results,
      analysis: data.analysis,
      previousCount,
      newCount,
      newResultsCount: Math.max(0, newCount - previousCount),
      metadata: data.metadata,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Alert check failed";
    res.status(502).json({ error: message });
  }
});

export default router;
