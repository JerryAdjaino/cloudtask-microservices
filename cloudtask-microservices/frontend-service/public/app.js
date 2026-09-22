let editingId = null;
const els = {
  form: document.querySelector("#taskForm"),
  title: document.querySelector("#title"),
  description: document.querySelector("#description"),
  priority: document.querySelector("#priority"),
  dueDate: document.querySelector("#dueDate"),
  formMessage: document.querySelector("#formMessage"),
  taskList: document.querySelector("#taskList"),
  statusFilter: document.querySelector("#statusFilter"),
  refreshButton: document.querySelector("#refreshButton"),
  connectionBadge: document.querySelector("#connectionBadge"),
  statTotal: document.querySelector("#statTotal"),
  statPending: document.querySelector("#statPending"),
  statProgress: document.querySelector("#statProgress"),
  statCompleted: document.querySelector("#statCompleted"),
  statOverdue: document.querySelector("#statOverdue"),
  statRate: document.querySelector("#statRate")
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readableDate(value) {
  if (!value) return "No due date";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "No due date" : `Due ${d.toLocaleDateString()}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function renderTasks(tasks) {
  if (!tasks.length) {
    els.taskList.innerHTML = '<div class="empty-state">No tasks match this view. Create a task to begin.</div>';
    return;
  }

  els.taskList.innerHTML = tasks.map(task => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    const actionText = task.status === "completed" ? "Reopen" : "Mark complete";
    return `
      <article class="task-card">
        <div class="task-card-top">
          <div>
            <h3>${escapeHtml(task.title)}</h3>
            <p>${escapeHtml(task.description || "No description")}</p>
          </div>
          <span class="badge ${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>
        </div>
        <div class="badges">
          <span class="badge ${escapeHtml(task.status)}">${escapeHtml(task.status.replace("-", " "))}</span>
          <span class="badge">${escapeHtml(readableDate(task.dueDate))}</span>
        </div>
        <div class="task-actions">
          <button class="task-button" data-action="status" data-id="${task._id}" data-status="${nextStatus}">${actionText}</button>
          ${task.status !== "completed" && task.status !== "in-progress" ? `<button class="task-button" data-action="status" data-id="${task._id}" data-status="in-progress">Start</button>` : ""}
          <button class="task-button" data-action="edit" data-id="${task._id}">Edit</button>
          <button class="task-button danger" data-action="delete" data-id="${task._id}">Delete</button>
        </div>
      </article>`;
  }).join("");
}

async function loadTasks() {
  const query = els.statusFilter.value ? `?status=${encodeURIComponent(els.statusFilter.value)}` : "";
  const tasks = [];
  let cursor;
  do {
    const params = new URLSearchParams(query.slice(1));
    params.set("limit", "1000");
    if (cursor) params.set("before", cursor);
    const data = await api(`/api/tasks?${params}`);
    tasks.push(...data.tasks);
    cursor = data.nextCursor;
  } while (cursor);
  renderTasks(tasks);
}

async function loadAnalytics() {
  const data = await api("/api/analytics");
  els.statTotal.textContent = data.total ?? 0;
  els.statPending.textContent = data.byStatus?.pending ?? 0;
  els.statProgress.textContent = data.byStatus?.["in-progress"] ?? 0;
  els.statCompleted.textContent = data.byStatus?.completed ?? 0;
  els.statOverdue.textContent = data.overdue ?? 0;
  els.statRate.textContent = `${data.completionRate ?? 0}%`;
}

async function refreshAll() {
  els.connectionBadge.textContent = "Refreshing…";
  els.connectionBadge.className = "connection-badge";
  try {
    await Promise.all([loadTasks(), loadAnalytics()]);
    els.connectionBadge.textContent = "Services online";
    els.connectionBadge.className = "connection-badge ok";
  } catch (error) {
    els.connectionBadge.textContent = "Service unavailable";
    els.connectionBadge.className = "connection-badge error";
    els.taskList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

els.form.addEventListener("submit", async event => {
  event.preventDefault();
  els.formMessage.className = "form-message";
  els.formMessage.textContent = "Creating task…";

  const payload = {
    title: els.title.value.trim(),
    description: els.description.value.trim(),
    priority: els.priority.value,
    dueDate: els.dueDate.value || null
  };

  try {
    await api(editingId ? `/api/tasks/${editingId}` : "/api/tasks", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) });
    editingId = null;
    els.form.querySelector("button[type=submit]").textContent = "Create task";
    els.form.reset();
    els.priority.value = "medium";
    els.formMessage.textContent = "Task saved successfully.";
    els.formMessage.classList.add("success");
    await refreshAll();
  } catch (error) {
    els.formMessage.textContent = error.message;
    els.formMessage.classList.add("error");
  }
});

els.taskList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  button.disabled = true;

  try {
    if (button.dataset.action === "edit") {
      const task = await api(`/api/tasks/${button.dataset.id}`);
      editingId = task._id;
      els.title.value = task.title;
      els.description.value = task.description;
      els.priority.value = task.priority;
      els.dueDate.value = task.dueDate ? task.dueDate.slice(0, 10) : "";
      els.form.querySelector("button[type=submit]").textContent = "Save changes";
      els.title.focus();
      return;
    }
    if (button.dataset.action === "delete") {
      await api(`/api/tasks/${button.dataset.id}`, { method: "DELETE" });
    } else if (button.dataset.action === "status") {
      await api(`/api/tasks/${button.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: button.dataset.status })
      });
    }
    await refreshAll();
  } catch (error) {
    els.formMessage.textContent = error.message;
    els.formMessage.className = "form-message error";
  } finally {
    button.disabled = false;
  }
});

els.statusFilter.addEventListener("change", refreshAll);
els.refreshButton.addEventListener("click", refreshAll);
refreshAll();

document.querySelector("#cancelEdit").addEventListener("click", () => { editingId = null; els.form.reset(); els.form.querySelector("button[type=submit]").textContent = "Create task"; els.formMessage.textContent = ""; });
