import type { Task, User } from "../api/types";

export const alice: User = { id: 1, email: "alice@example.com", full_name: "Alice Smith" };

let nextId = 100;

export function makeTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id ?? nextId++;
  return {
    id,
    project: 1,
    project_name: "Website",
    title: `Task ${id}`,
    description: "",
    status: "todo",
    priority: "medium",
    assignee: null,
    assignee_detail: null,
    due_date: null,
    position: 0,
    created_by: alice,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    completed_at: null,
    comment_count: 0,
    is_overdue: false,
    ...overrides,
  };
}
