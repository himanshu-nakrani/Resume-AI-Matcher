import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { metricsMiddleware } from "./middlewares/metrics";
import { requestIdMiddleware } from "./middlewares/request-id";

const app: Express = express();

app.use(requestIdMiddleware);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Observe all /api/* requests for metrics.
app.use("/api", metricsMiddleware);

app.use("/api", router);

export default app;
