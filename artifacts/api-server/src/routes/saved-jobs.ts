import { Router, type IRouter } from "express";
import { eq, desc, and, like, or } from "drizzle-orm";
import { db, savedJobs } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const SavedJobBody = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500),
  company: z.string().max(200).optional(),
  source: z.string().max(200).optional(),
  publishedDate: z.string().max(50).nullable().optional(),
  highlights: z.array(z.string()).optional(),
  salary: z.string().max(100).nullable().optional(),
  applyType: z.enum(["ats", "external", "unknown"]).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string().max(50)).optional(),
});

router.get("/saved-jobs", async (req, res) => {
  const rows = await db.select().from(savedJobs).orderBy(desc(savedJobs.savedAt));
  res.json(rows);
});

router.post("/saved-jobs", async (req, res) => {
  const parsed = SavedJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(savedJobs).where(eq(savedJobs.url, parsed.data.url));
  if (existing.length > 0) {
    res.status(409).json({ error: "Job already saved", existing: existing[0] });
    return;
  }

  const [row] = await db.insert(savedJobs).values({
    ...parsed.data,
    publishedDate: parsed.data.publishedDate ?? undefined,
  }).returning();
  res.status(201).json(row);
});

router.delete("/saved-jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.delete(savedJobs).where(eq(savedJobs.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.patch("/saved-jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(savedJobs).where(eq(savedJobs.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const body = z.object({
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (body.data.notes !== undefined) updates.notes = body.data.notes;
  if (body.data.tags !== undefined) updates.tags = body.data.tags;

  const [updated] = await db.update(savedJobs).set(updates).where(eq(savedJobs.id, id)).returning();
  res.json(updated);
});

export default router;
