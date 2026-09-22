import test from "node:test";
import assert from "node:assert/strict";
import { calculateStats } from "../src/stats.js";

test("calculates status, priority, and completion rate", () => {
  const tasks = [
    { status: "pending", priority: "high", dueDate: null },
    { status: "completed", priority: "medium", dueDate: null }
  ];
  const stats = calculateStats(tasks, new Date("2026-09-22T00:00:00Z"));
  assert.equal(stats.total, 2);
  assert.equal(stats.byStatus.pending, 1);
  assert.equal(stats.byStatus.completed, 1);
  assert.equal(stats.byPriority.high, 1);
  assert.equal(stats.completionRate, 50);
});

test("counts overdue and next-seven-day tasks", () => {
  const tasks = [
    { status: "pending", priority: "low", dueDate: "2026-09-21T00:00:00Z" },
    { status: "in-progress", priority: "high", dueDate: "2026-09-25T00:00:00Z" },
    { status: "completed", priority: "medium", dueDate: "2026-09-20T00:00:00Z" }
  ];
  const stats = calculateStats(tasks, new Date("2026-09-22T00:00:00Z"));
  assert.equal(stats.overdue, 1);
  assert.equal(stats.dueNext7Days, 1);
});
