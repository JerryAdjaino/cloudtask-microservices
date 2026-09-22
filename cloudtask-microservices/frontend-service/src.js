import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const taskServiceUrl = process.env.TASK_SERVICE_URL || "http://localhost:4000";
const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:5000";
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 5000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: { "upgrade-insecure-requests": null } } }));
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "frontend-service" });
});

app.get("/api/info", (_req, res) => {
  res.json({
    application: "CloudTask",
    service: "frontend-service",
    architecture: "microservices",
    downstreamServices: ["task-service", "analytics-service"]
  });
});

async function forward(req, res, baseUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const targetUrl = `${baseUrl}${req.originalUrl}`;
    const headers = { accept: "application/json" };
    const options = {
      method: req.method,
      headers,
      signal: controller.signal
    };

    if (!["GET", "HEAD"].includes(req.method) && req.body !== undefined) {
      headers["content-type"] = "application/json";
      options.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, options);
    const contentType = upstream.headers.get("content-type") || "application/json";
    const payload = await upstream.text();
    res.status(upstream.status).set("content-type", contentType).send(payload);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    res.status(503).json({
      error: timedOut ? "Upstream service timed out" : "Upstream service unavailable"
    });
  } finally {
    clearTimeout(timer);
  }
}

app.use("/api/tasks", (req, res) => forward(req, res, taskServiceUrl));
app.use("/api/analytics", (req, res) => forward(req, res, analyticsServiceUrl));

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));


app.use((error, _req, res, _next) => {
  const status = error.type === "entity.parse.failed" ? 400 : error.type === "entity.too.large" ? 413 : 500;
  res.status(status).json({ error: status === 400 ? "Invalid JSON" : status === 413 ? "Request body too large" : "Internal server error" });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`frontend-service listening on port ${port}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); });
