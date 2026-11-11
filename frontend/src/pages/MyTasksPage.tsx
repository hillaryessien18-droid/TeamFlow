import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { errorMessage } from "../api/client";
import { taskApi } from "../api/endpoints";
import type { Task } from "../api/types";
import { CalendarIcon, ChatIcon, CheckIcon, ChevronRightIcon } from "../components/icons";
import { Alert, Card, cn, EmptyState, LabelChip, PageHeader, PageLoader, PriorityBadge } from "../components/ui";
import { useOrg } from "../context/OrgContext";
import { formatDate, parseDate, todayISO } from "../lib/format";
import { PRIORITIES, projectColor, STATUS_META } from "../lib/meta";
import { useLoader } from "../lib/useLoader";

type Group = "overdue" | "today" | "week" | "later" | "none";

const GROUPS: { key: Group; title: string; accent: string }[] = [
  { key: "overdue", title: "Overdue", accent: "text-red-600" },
  { key: "today", title: "Due today", accent: "text-amber-700" },
  { key: "week", title: "Next 7 days", accent: "text-brand-600" },
  { key: "later", title: "Later", accent: "text-brand-600" },
  { key: "none", title: "No deadline", accent: "text-slate-500" },
];

function groupOf(task: Task, today: string): Group {
  if (!task.due_date) return "none";
  if (task.is_overdue) return "overdue";
  if (task.due_date === today) return "today";
  const days = (parseDate(task.due_date).getTime() - parseDate(today).getTime()) / 86_400_000;
  return days <= 7 ? "week" : "later";
}

/** Sort by deadline, then priority (urgent first). */
function compareTasks(a: Task, b: Task) {
  const due = (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  return due || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
}

export function MyTasksPage() {
  const { current } = useOrg();
  const tasks = useLoader(() => taskApi.list({ organization: current!.id, assignee: "me" }), [current?.id]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { groups, completed, openCount } = useMemo(() => {
    const today = todayISO();
    const all = [...(tasks.data ?? [])].sort(compareTasks);
    const open = all.filter((t) => t.status !== "completed");
    const byGroup = Object.fromEntries(GROUPS.map((g) => [g.key, [] as Task[]])) as Record<Group, Task[]>;
    open.forEach((t) => byGroup[groupOf(t, today)].push(t));
    const done = all
      .filter((t) => t.status === "completed")
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    return { groups: byGroup, completed: done, openCount: open.length };
  }, [tasks.data]);

  async function toggleDone(task: Task) {
    setError(null);
    const status = task.status === "completed" ? "todo" : "completed";
    tasks.setData((prev) => prev?.map((t) => (t.id === task.id ? { ...t, status } : t)) ?? null);
    try {
      await taskApi.update(task.id, { status });
    } catch (err) {
      setError(errorMessage(err));
    }
    void tasks.reload(true);
  }

  if (!current) return null;

  function renderBody() {
    if (tasks.loading) return <PageLoader />;
    if (tasks.error) return <Alert>{tasks.error}</Alert>;
    if ((tasks.data ?? []).length === 0) {
      return (
        <EmptyState
          title="Nothing assigned to you"
          description="Tasks assigned to you in any project show up here, sorted by deadline."
          action={
            <Link to="/projects" className="text-sm font-semibold text-brand-600 hover:text-brand-500">
              Browse projects →
            </Link>
          }
        />
      );
    }
    return (
      <div className="space-y-6">
        {openCount === 0 && (
          <Card className="px-5 py-8 text-center">
            <p className="font-display text-lg font-bold text-brand-600">You're all caught up 🎉</p>
            <p className="mt-1 text-sm text-slate-500">Every task assigned to you is complete.</p>
          </Card>
        )}
        {GROUPS.filter((g) => groups[g.key].length > 0).map((g) => (
          <TaskGroup key={g.key} title={g.title} accent={g.accent} tasks={groups[g.key]} onToggle={toggleDone} />
        ))}
        {completed.length > 0 && (
          <section>
            <button
              type="button"
              aria-expanded={showCompleted}
              onClick={() => setShowCompleted((v) => !v)}
              className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700"
            >
              <ChevronRightIcon className={cn("size-4 transition", showCompleted && "rotate-90")} />
              Completed
              <span className="rounded-full bg-slate-100 px-2 text-xs font-medium">{completed.length}</span>
            </button>
            {showCompleted && <TaskRows tasks={completed} onToggle={toggleDone} />}
          </section>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="My Tasks"
        description={
          tasks.data
            ? `${openCount} open ${openCount === 1 ? "task" : "tasks"} assigned to you in ${current.name}.`
            : `Tasks assigned to you in ${current.name}.`
        }
      />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {renderBody()}
    </>
  );
}

function TaskGroup({
  title,
  accent,
  tasks,
  onToggle,
}: Readonly<{ title: string; accent: string; tasks: Task[]; onToggle: (task: Task) => void }>) {
  return (
    <section>
      <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-bold", accent)}>
        {title}
        <span className="rounded-full bg-white px-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">{tasks.length}</span>
      </h2>
      <TaskRows tasks={tasks} onToggle={onToggle} />
    </section>
  );
}

function TaskRows({ tasks, onToggle }: Readonly<{ tasks: Task[]; onToggle: (task: Task) => void }>) {
  return (
    <Card className="divide-y divide-slate-100 overflow-hidden">
      {tasks.map((task) => {
        const done = task.status === "completed";
        return (
          <div key={task.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
            <button
              type="button"
              onClick={() => onToggle(task)}
              aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
              aria-pressed={done}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition",
                done
                  ? "bg-emerald-500 text-white ring-emerald-500"
                  : "text-transparent ring-slate-300 hover:text-emerald-600 hover:ring-emerald-500",
              )}
            >
              <CheckIcon className="size-3" />
            </button>
            <Link to={`/projects/${task.project}?task=${task.id}`} className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className={cn("truncate text-sm font-medium text-slate-800 group-hover:text-brand-600", done && "text-slate-400 line-through")}>
                {task.title}
              </span>
              <span className="flex flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0">
                {task.labels.slice(0, 2).map((label) => (
                  <LabelChip key={label.id} label={label} />
                ))}
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={cn("size-2 rounded-sm", projectColor(task.project))} />
                  {task.project_name}
                </span>
                {!done && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <span className={cn("size-1.5 rounded-full", STATUS_META[task.status].dot)} />
                    {STATUS_META[task.status].label}
                  </span>
                )}
                {task.comment_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400" aria-label={`${task.comment_count} comments`}>
                    <ChatIcon className="size-3.5" />
                    {task.comment_count}
                  </span>
                )}
                <PriorityBadge priority={task.priority} />
                {task.due_date && (
                  <span
                    className={cn(
                      "inline-flex w-24 items-center gap-1 text-xs text-slate-500",
                      task.is_overdue && !done && "font-medium text-red-600",
                    )}
                  >
                    <CalendarIcon className="size-3.5" />
                    {formatDate(task.due_date)}
                  </span>
                )}
              </span>
            </Link>
          </div>
        );
      })}
    </Card>
  );
}
