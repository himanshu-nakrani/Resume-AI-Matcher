import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { seedSampleAnalysisIfEmpty } from "./lib/seed-sample-analysis";
import { setAiTokenRecorder } from "@workspace/integrations-openai-ai-server";
import { aiTokensTotal } from "./lib/metrics";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedSampleAnalysisIfEmpty();

setAiTokenRecorder(({ model, route, outcome, tokens }) => {
  aiTokensTotal.inc({ model, route, outcome }, tokens);
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
