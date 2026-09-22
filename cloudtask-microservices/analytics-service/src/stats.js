export function calculateStats(tasks, now = new Date()) {
  const byStatus = { pending: 0, "in-progress": 0, completed: 0 };
  const byPriority = { low: 0, medium: 0, high: 0 };
  let overdue = 0;
  let dueNext7Days = 0;
  const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

  for (const task of tasks) {
    if (Object.hasOwn(byStatus, task.status)) byStatus[task.status] += 1;
    if (Object.hasOwn(byPriority, task.priority)) byPriority[task.priority] += 1;

    if (task.dueDate && task.status !== "completed") {
      const due = new Date(task.dueDate);
      if (!Number.isNaN(due.getTime())) {
        if (due < now) overdue += 1;
        else if (due <= sevenDaysFromNow) dueNext7Days += 1;
      }
    }
  }

  const total = tasks.length;
  const completed = byStatus.completed;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    byStatus,
    byPriority,
    overdue,
    dueNext7Days,
    completionRate,
    generatedAt: now.toISOString()
  };
}
