import { useMemo, useState, type DragEvent } from "react";

import type { Task, TaskStatus } from "../api/types";
import { groupByStatus } from "../lib/board";
import { formatDate } from "../lib/format";
import { STATUSES, STATUS_META } from "../lib/meta";
import { CalendarIcon, ChatIcon, CheckIcon, PlusIcon } from "./icons";
import { Avatar, cn, PriorityBadge } from "./ui";

interface Props {
  tasks: Task[];
  readOnly?: boolean;
  /** `beforeId` is the card the task was dropped in front of, or null for the end of the column. */
  onMove: (taskId: number, status: TaskStatus, beforeId: number | null) => void;
  onOpen: (task: Task) => void;
  onAdd?: (status: TaskStatus) => void;
}

interface DropTarget {
  status: TaskStatus;
  beforeId: number | null;
}

export function KanbanBoard({ tasks, readOnly = false, onMove, onOpen, onAdd }: Readonly<Props>) {
  const columns = useMemo(() => groupByStatus(tasks), [tasks]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);

  function reset() {
    setDragId(null);
    setTarget(null);
  }

  function updateTarget(next: DropTarget) {
    if (target?.status !== next.status || target.beforeId !== next.beforeId) setTarget(next);
  }

  function overCard(event: DragEvent, status: TaskStatus, index: number) {
    if (dragId === null) return;
    event.preventDefault();
    event.stopPropagation();
    const column = columns[status];
    const card = column[index];
    if (card.id === dragId) {
      // Hovering over itself: dropping here keeps the current position.
      updateTarget({ status, beforeId: column[index + 1]?.id ?? null });
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const lowerHalf = rect.height > 0 && event.clientY > rect.top + rect.height / 2;
    if (!lowerHalf) {
      updateTarget({ status, beforeId: card.id });
      return;
    }
    const next = column.slice(index + 1).find((t) => t.id !== dragId);
    updateTarget({ status, beforeId: next?.id ?? null });
  }

  function drop(event: DragEvent, status: TaskStatus) {
    event.preventDefault();
    const id = dragId ?? Number(event.dataTransfer?.getData("text/plain"));
    const beforeId = target?.status === status ? target.beforeId : null;
    reset();
    if (id) onMove(id, status, beforeId);
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {STATUSES.map((status) => {
        const column = columns[status];
        const meta = STATUS_META[status];
        const isTarget = target?.status === status;
        return (
          <section
            key={status}
            aria-label={`${meta.label} column`}
            data-testid={`column-${status}`}
            onDragOver={(event) => {
              if (dragId === null) return;
              event.preventDefault();
              if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
              if (target?.status !== status) updateTarget({ status, beforeId: null });
            }}
            onDrop={(event) => drop(event, status)}
            className={cn(
              "flex min-h-64 flex-col rounded-2xl bg-brand-50/70 p-3 ring-1 ring-brand-100 transition",
              isTarget && "bg-brand-100/70 ring-2 ring-brand-300",
            )}
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <span className={cn("size-2 rounded-full", meta.dot)} />
              <h2 className="text-sm font-bold text-brand-600">{meta.label}</h2>
              <span className="rounded-full bg-white px-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                {column.length}
              </span>
              {onAdd && !readOnly && (
                <button
                  type="button"
                  onClick={() => onAdd(status)}
                  aria-label={`Add task to ${meta.label}`}
                  className="ml-auto rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <PlusIcon className="size-4" />
                </button>
              )}
            </header>

            <ol className="flex flex-1 flex-col gap-2">
              {column.map((task, index) => (
                <li
                  key={task.id}
                  onDragOver={(event) => overCard(event, status, index)}
                >
                  {isTarget && target.beforeId === task.id && task.id !== dragId && <DropLine />}
                  <TaskCard
                    task={task}
                    draggable={!readOnly}
                    dragging={dragId === task.id}
                    onOpen={() => onOpen(task)}
                    onDragStart={(event) => {
                      setDragId(task.id);
                      if (event.dataTransfer) {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(task.id));
                      }
                    }}
                    onDragEnd={reset}
                  />
                </li>
              ))}
              {isTarget && target.beforeId === null && dragId !== null && <DropLine />}
              {column.length === 0 && !isTarget && (
                <li className="rounded-lg border-2 border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                  {readOnly ? "No tasks" : "Drop tasks here"}
                </li>
              )}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function DropLine() {
  return <div className="mb-2 h-1 rounded-full bg-brand-400" aria-hidden="true" />;
}

interface CardProps {
  task: Task;
  draggable: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}

function TaskCard({ task, draggable, dragging, onOpen, onDragStart, onDragEnd }: Readonly<CardProps>) {
  return (
    // A native <button> can't be dragged in Firefox (bugzilla.mozilla.org/show_bug.cgi?id=568313),
    // so the card keeps role="button" with its own keyboard handling.
    <article // NOSONAR
      role="button" // NOSONAR
      tabIndex={0}
      draggable={draggable}
      aria-label={task.title}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-pointer rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-px hover:shadow-md hover:ring-brand-300 focus-visible:outline-2 focus-visible:outline-brand-600",
        draggable && "active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={cn("flex items-start gap-1.5 font-sans text-sm font-semibold text-slate-800", task.status === "completed" && "text-slate-400")}>
          {task.status === "completed" && (
            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckIcon className="size-2.5" />
            </span>
          )}
          <span className={cn(task.status === "completed" && "line-through")}>{task.title}</span>
        </h3>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
        {task.due_date && (
          <span className={cn("inline-flex items-center gap-1", task.is_overdue && "font-medium text-red-600")}>
            <CalendarIcon className="size-3.5" />
            {formatDate(task.due_date)}
            {task.is_overdue && <span className="sr-only">(overdue)</span>}
          </span>
        )}
        {task.comment_count > 0 && (
          <span className="inline-flex items-center gap-1" aria-label={`${task.comment_count} comments`}>
            <ChatIcon className="size-3.5" />
            {task.comment_count}
          </span>
        )}
        <span className="ml-auto">
          <Avatar user={task.assignee_detail} size="sm" />
        </span>
      </div>
    </article>
  );
}
