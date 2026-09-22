export const ALLOWED_STATUS = new Set(["pending", "in-progress", "completed"]);
export const ALLOWED_PRIORITY = new Set(["low", "medium", "high"]);

function cleanString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return Symbol.for("invalid");
  return value.trim();
}

export function validateTaskInput(input, { partial = false } = {}) {
  const errors = [];
  const value = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: ["Body must be an object"], value };
  const fields = new Set(["title", "description", "status", "priority", "dueDate"]);
  if (Object.keys(input).some(key => !fields.has(key))) errors.push("Unknown task field");

  if (!partial || input.title !== undefined) {
    const title = cleanString(input.title);
    if (typeof title === "symbol" || !title) errors.push("title is required and must be a non-empty string");
    else if (title.length > 120) errors.push("title must be 120 characters or fewer");
    else value.title = title;
  }

  if (input.description !== undefined) {
    const description = cleanString(input.description);
    if (typeof description === "symbol") errors.push("description must be a string");
    else if ((description || "").length > 1000) errors.push("description must be 1000 characters or fewer");
    else value.description = description || "";
  }

  if (input.status !== undefined) {
    if (!ALLOWED_STATUS.has(input.status)) errors.push("status must be pending, in-progress, or completed");
    else value.status = input.status;
  }

  if (input.priority !== undefined) {
    if (!ALLOWED_PRIORITY.has(input.priority)) errors.push("priority must be low, medium, or high");
    else value.priority = input.priority;
  }

  if (input.dueDate !== undefined) {
    if (input.dueDate === null || input.dueDate === "") {
      value.dueDate = null;
    } else {
      const date = typeof input.dueDate === "string" && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(input.dueDate) ? new Date(input.dueDate) : new Date(NaN);
      if (Number.isNaN(date.getTime())) errors.push("dueDate must be a valid date or null");
      else value.dueDate = date;
    }
  }

  return { errors, value };
}
