import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { validateTaskInput, ALLOWED_PRIORITY, ALLOWED_STATUS } from "./validation.js";

const port = Number(process.env.PORT || 4000);
const mongoHost = process.env.MONGO_HOST || "localhost";
const mongoPort = process.env.MONGO_PORT || "27017";
const mongoDb = process.env.MONGO_DB || "cloudtask";
const mongoUsername = process.env.MONGO_USERNAME || "";
const mongoPassword = process.env.MONGO_PASSWORD || "";
if (!!mongoUsername !== !!mongoPassword) throw new Error("Supply both MongoDB username and password");
const credentials = mongoUsername ? `${encodeURIComponent(mongoUsername)}:${encodeURIComponent(mongoPassword)}@` : "";
const mongoUri = process.env.MONGO_URI || `mongodb://${credentials}${mongoHost}:${mongoPort}/${mongoDb}${credentials ? "?authSource=admin" : ""}`;
mongoose.set("bufferCommands", false);

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: "", maxlength: 1000 },
  status: { type: String, enum: [...ALLOWED_STATUS], default: "pending", index: true },
  priority: { type: String, enum: [...ALLOWED_PRIORITY], default: "medium", index: true },
  dueDate: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

const Task = mongoose.model("Task", taskSchema);
const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "32kb" }));
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
  res.json({ status: "ok", service: "task-service" });
});

app.get("/ready", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not-ready", database: ready ? "connected" : "disconnected" });
});

app.get("/api/tasks", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      if (!ALLOWED_STATUS.has(req.query.status)) return res.status(400).json({ error: "Invalid status filter" });
      filter.status = req.query.status;
    }
    if (req.query.priority) {
      if (!ALLOWED_PRIORITY.has(req.query.priority)) return res.status(400).json({ error: "Invalid priority filter" });
      filter.priority = req.query.priority;
    }

    const limit = Number(req.query.limit ?? 200);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return res.status(400).json({ error: "limit must be 1..1000" });
    if (req.query.before) {
      if (typeof req.query.before !== "string" || !mongoose.isValidObjectId(req.query.before)) return res.status(400).json({ error: "Invalid cursor" });
      filter._id = { $lt: req.query.before };
    }
    const tasks = await Task.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
    const hasMore = tasks.length > limit;
    if (hasMore) tasks.pop();
    res.json({ count: tasks.length, tasks, nextCursor: hasMore ? String(tasks.at(-1)._id) : null });
  } catch (error) { next(error); }
});

app.get("/api/tasks/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid task id" });
    const task = await Task.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error) { next(error); }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    const { errors, value } = validateTaskInput(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });
    const task = await Task.create(value);
    res.status(201).json(task);
  } catch (error) { next(error); }
});

app.patch("/api/tasks/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid task id" });
    const { errors, value } = validateTaskInput(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });
    if (!Object.keys(value).length) return res.status(400).json({ error: "No valid task fields supplied" });

    const task = await Task.findByIdAndUpdate(req.params.id, value, { new: true, runValidators: true }).lean();
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error) { next(error); }
});

app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid task id" });
    const task = await Task.findByIdAndDelete(req.params.id).lean();
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error("task-service error", error.message);
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database unavailable" });
  if (error?.name === "ValidationError") return res.status(400).json({ error: "Task validation failed" });
  res.status(500).json({ error: "Internal server error" });
});

async function connectWithRetry() {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      console.log("task-service connected to MongoDB");
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

await connectWithRetry();
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`task-service listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`task-service received ${signal}; shutting down`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
