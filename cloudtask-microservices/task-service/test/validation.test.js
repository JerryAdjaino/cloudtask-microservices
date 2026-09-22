import test from "node:test";
import assert from "node:assert/strict";
import { validateTaskInput } from "../src/validation.js";

test("accepts a valid task", () => {
  const result = validateTaskInput({ title: "Deploy app", priority: "high", status: "pending" });
  assert.equal(result.errors.length, 0);
  assert.equal(result.value.title, "Deploy app");
});

test("rejects missing title for a new task", () => {
  const result = validateTaskInput({ description: "No title" });
  assert.ok(result.errors.length > 0);
});

test("rejects invalid status", () => {
  const result = validateTaskInput({ title: "Task", status: "unknown" });
  assert.ok(result.errors.some(error => error.includes("status")));
});
