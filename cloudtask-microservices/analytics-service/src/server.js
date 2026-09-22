import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { calculateStats } from "./stats.js";

const app = express();
const port = Number(process.env.PORT || 5000);
const taskServiceUrl = process.env.TASK_SERVICE_URL || "http://localhost:4000";
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 4000);

app.disable("x-powered-by");
app.use(helmet());
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});
app.use("/api", rateLimit({
  windowMs: 60_000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "analytics-service" });
});

app.get("/api/analytics", async (_req, res) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const tasks = [];
    let cursor = null;
    const seen = new Set();
    do {
      const url = new URL("/api/tasks", taskServiceUrl);
      url.searchParams.set("limit", "1000");
      if (cursor) url.searchParams.set("before", cursor);
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
      console.log(`GET task-service/api/tasks -> ${response.status}`);
      if (!response.ok) throw new Error(`Task Service returned HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.tasks)) throw new Error("Invalid Task Service response");
      tasks.push(...data.tasks);
      cursor = data.nextCursor;
      if (cursor && seen.has(cursor)) throw new Error("Repeated pagination cursor");
      seen.add(cursor);
    } while (cursor);
    res.json(calculateStats(tasks));
  } catch (error) {
    console.error("analytics-service could not query task-service", error.message);
    res.status(503).json({
      error: "Task Service is currently unavailable",
      service: "analytics-service"
    });
  } finally {
    clearTimeout(timer);
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`analytics-service listening on port ${port}; task-service=${taskServiceUrl}`);
});
