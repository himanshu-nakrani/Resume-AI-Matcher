import { defineConfig } from "drizzle-kit";
import path from "path";
import { pathToFileURL } from "node:url";

const defaultDbFile = path.resolve(process.cwd(), "..", "..", "resume-matcher.sqlite");
const url = process.env.DATABASE_URL?.trim() ?? pathToFileURL(defaultDbFile).href;

export default defineConfig({
  schema: path.join(process.cwd(), "src/schema/index.ts"),
  dialect: "sqlite",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
});
