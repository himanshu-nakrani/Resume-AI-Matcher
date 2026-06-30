import { Router, type IRouter } from "express";
import { registry } from "../lib/metrics";

const router: IRouter = Router();

router.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

export default router;
