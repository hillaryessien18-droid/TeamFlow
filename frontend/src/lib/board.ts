import type { Task, TaskStatus } from "../api/types";
import { STATUSES } from "./meta";

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const columns: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], completed: [] };
  for (const task of tasks) columns[task.status].push(task);
  for (const status of STATUSES) columns[status].sort((a, b) => a.position - b.position || a.id - b.id);
  return columns;
}

/**
 * Mirror the server's move endpoint locally for an optimistic update: take the task out,
 * insert it into `status` at `position`, and renumber every column from zero.
 */
export function moveTask(tasks: Task[], taskId: number, status: TaskStatus, position: number): Task[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;
  const columns = groupByStatus(tasks.filter((t) => t.id !== taskId));
  const target = columns[status];
  target.splice(Math.max(0, Math.min(position, target.length)), 0, { ...task, status });
  return STATUSES.flatMap((s) => columns[s].map((t, index) => ({ ...t, position: index })));
}

/** Position the server expects when dropping `taskId` before `beforeId` (or at the end when null). */
export function dropPosition(tasks: Task[], taskId: number, status: TaskStatus, beforeId: number | null): number {
  const column = groupByStatus(tasks.filter((t) => t.id !== taskId))[status];
  if (beforeId === null) return column.length;
  const index = column.findIndex((t) => t.id === beforeId);
  return index === -1 ? column.length : index;
}
