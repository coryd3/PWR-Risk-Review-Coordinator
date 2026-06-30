import app from "./app";
import { logger } from "./lib/logger";

// Portability: prefer Databricks App port, then the platform PORT, then a local default.
const port = Number(
  process.env["DATABRICKS_APP_PORT"] || process.env["PORT"] || 3000,
);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid port value resolved: "${port}"`);
}

// Bind to 0.0.0.0 so the server is reachable in container/cloud environments.
app.listen(port, "0.0.0.0", (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
