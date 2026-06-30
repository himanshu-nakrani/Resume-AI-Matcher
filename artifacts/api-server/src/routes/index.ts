import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysesRouter from "./analyses";
import jobSearchRouter from "./job-search";
import savedJobsRouter from "./saved-jobs";
import searchAlertsRouter from "./search-alerts";
import metricsRouter from "./metrics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(metricsRouter);
router.use(jobSearchRouter);
router.use(savedJobsRouter);
router.use(searchAlertsRouter);
router.use(analysesRouter);

export default router;
