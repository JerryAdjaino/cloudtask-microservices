# CloudTask API Reference

## Task Service

### GET `/api/tasks`
Optional query parameters:
- `status=pending|in-progress|completed`
- `priority=low|medium|high`
- `limit=1..1000` (default 200; invalid values return 400)
- `before=<nextCursor>` for the next page in descending ID order

Response: `{ count, tasks, nextCursor }`; a null cursor ends pagination. Analytics and frontend follow all pages. Concurrent writes do not provide a transactional snapshot.

### GET `/api/tasks/:id`
Returns one task, 400 for invalid ID, or 404 for a missing record.

### POST `/api/tasks`

```json
{
  "title": "Prepare demo",
  "description": "Record the Kubernetes walkthrough",
  "priority": "high",
  "status": "pending",
  "dueDate": "2026-09-25"
}
```

### PATCH `/api/tasks/:id`
Any subset of the task fields may be supplied.

```json
{
  "status": "completed"
}
```

### DELETE `/api/tasks/:id`
Returns HTTP 204 on success.

## Analytics Service

### GET `/api/analytics`

The service obtains task data by making an HTTP REST call to Task Service and returns calculated metrics.

Example response:

```json
{
  "total": 4,
  "byStatus": {
    "pending": 2,
    "in-progress": 1,
    "completed": 1
  },
  "byPriority": {
    "low": 1,
    "medium": 2,
    "high": 1
  },
  "overdue": 1,
  "dueNext7Days": 2,
  "completionRate": 25,
  "generatedAt": "2026-09-22T12:00:00.000Z"
}
```

POST returns 201; PATCH returns 200; invalid/unknown fields and malformed JSON return 400, oversized bodies 413. Due dates accept date strings or null. Analytics returns 503 if Task Service fails or the overall REST pagination deadline expires.
