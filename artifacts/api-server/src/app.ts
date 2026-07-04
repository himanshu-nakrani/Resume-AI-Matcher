import express, {
  type ErrorRequestHandler,
  type Express,
  type Request,
  type Response,
} from "express";
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

function requestId(req: Request): string | undefined {
  return (req as Request & { id?: string }).id;
}

app.use("/api", (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "not_found",
      message: `No API route matches ${req.method} ${req.originalUrl.split("?")[0]}.`,
      requestId: requestId(req),
    },
  });
});

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const statusFromError =
    typeof err === "object" && err !== null
      ? Number(
          (err as { status?: unknown; statusCode?: unknown }).status ??
            (err as { statusCode?: unknown }).statusCode,
        )
      : NaN;
  const status =
    Number.isInteger(statusFromError) &&
    statusFromError >= 400 &&
    statusFromError < 600
      ? statusFromError
      : 500;
  const isJsonParseError =
    typeof err === "object" &&
    err !== null &&
    (err as { type?: unknown }).type === "entity.parse.failed";
  const message = isJsonParseError
    ? "Invalid JSON request body."
    : status >= 500
      ? "Internal server error."
      : err instanceof Error && err.message
        ? err.message
        : "Request failed.";

  if (isJsonParseError) {
    req.log?.warn(
      { errorType: "entity.parse.failed", statusCode: status },
      "API request failed",
    );
  } else {
    req.log?.error({ err, statusCode: status }, "API request failed");
  }

  res.status(status).json({
    error: {
      code: isJsonParseError
        ? "invalid_json"
        : status === 404
          ? "not_found"
          : status >= 500
            ? "internal_error"
            : "request_failed",
      message,
      requestId: requestId(req),
    },
  });
};

app.use(errorHandler);

export default app;
