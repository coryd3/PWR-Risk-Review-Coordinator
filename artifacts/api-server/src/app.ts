import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { authMiddleware } from "./middlewares/authMiddleware";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

// Portability: in production the single Express process also serves the built
// React frontend assets (e.g. for a Databricks App deployment). In Replit dev
// the frontend runs as its own Vite artifact, so this is gated on NODE_ENV.
if (process.env["NODE_ENV"] === "production") {
  const frontendDist =
    process.env["FRONTEND_DIST"] ||
    path.resolve(process.cwd(), "artifacts/risk-coordinator/dist/public");

  app.use(express.static(frontendDist));

  // SPA fallback: serve index.html for any non-API GET that isn't a static file.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
