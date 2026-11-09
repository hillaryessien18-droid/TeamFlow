import { Link } from "react-router-dom";

import { dashboardApi } from "../api/endpoints";
import type { Dashboard } from "../api/types";
import { ActivityFeed } from "../components/ActivityFeed";
import { Alert, Card, cn, EmptyState, PageHeader, PageLoader, PriorityBadge, ProgressBar } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import { formatDate } from "../lib/format";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "../lib/meta";
import { useLoader } from "../lib/useLoader";

function Stat({
  label,
  value,
  hint,
  icon,
  tone,
}: Readonly<{
  label: string;
  value: string | number;
  hint?: string;
  icon: string;
  tone?: "danger";
}>) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-50 text-lg" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className={cn("mt-1 font-display text-3xl font-extrabold tabular-nums", tone === "danger" ? "text-red-600" : "text-brand-600")}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

function StatusBreakdown({ tasks }: Readonly<{ tasks: Dashboard["tasks"] }>) {
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {tasks.total > 0 &&
          STATUSES.map((s) => (
            <div key={s} className={STATUS_META[s].bar} style={{ width: `${(tasks[s] / tasks.total) * 100}%` }} />
          ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        {STATUSES.map((s) => (
          <div key={s}>
            <dt className="flex items-center gap-1.5 text-slate-500">
              <span className={cn("size-2 rounded-full", STATUS_META[s].dot)} />
              {STATUS_META[s].label}
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{tasks[s]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { current } = useOrg();
  const dashboard = useLoader(() => dashboardApi.get(current!.id), [current?.id]);

  if (!current) return null;
  if (dashboard.loading) return <PageLoader />;
  if (dashboard.error || !dashboard.data) return <Alert>{dashboard.error ?? "Could not load the dashboard."}</Alert>;
  const data = dashboard.data;
  const openTasks = data.tasks.todo + data.tasks.in_progress;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.full_name.split(" ")[0] ?? ""}`}
        description={`Here's how ${current.name} is doing across ${data.projects.active} active project${data.projects.active === 1 ? "" : "s"}.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon="📁" label="Active projects" value={data.projects.active} hint={`${data.projects.archived} archived`} />
        <Stat icon="📝" label="Open tasks" value={openTasks} hint={`${data.tasks.total} total`} />
        <Stat icon="📈" label="Completion rate" value={`${data.tasks.completion_rate}%`} hint={`${data.tasks.completed} completed`} />
        <Stat icon="⏰" label="Overdue" value={data.tasks.overdue} hint="Open tasks past deadline" tone={data.tasks.overdue ? "danger" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-display text-base font-bold text-brand-600">Task status</h2>
            <div className="mt-4">
              <StatusBreakdown tasks={data.tasks} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-brand-600">Project progress</h2>
              <Link to="/projects" className="text-sm font-medium text-brand-600 hover:text-brand-500">
                All projects
              </Link>
            </div>
            {data.project_progress.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No active projects"
                  description="Projects you create will show their progress here."
                  action={
                    <Link to="/projects" className="text-sm font-medium text-brand-600 hover:text-brand-500">
                      Go to projects →
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-4">
                {data.project_progress.map((project) => (
                  <li key={project.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <Link to={`/projects/${project.id}`} className="truncate font-medium text-slate-900 hover:text-brand-600">
                        {project.name}
                      </Link>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        {project.completed_count}/{project.task_count} · {project.progress}%
                      </span>
                    </div>
                    <ProgressBar value={project.progress} label={`${project.name} progress`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-bold text-brand-600">Recent activity</h2>
            <div className="mt-2">
              <ActivityFeed items={data.recent_activity} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-display text-base font-bold text-brand-600">My open tasks</h2>
            {data.my_tasks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nothing assigned to you right now. 🎉</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {data.my_tasks.map((task) => (
                  <li key={task.id} className="py-2.5">
                    <Link to={`/projects/${task.project}?task=${task.id}`} className="group block">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900 group-hover:text-brand-600">{task.title}</span>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {task.project_name}
                        {task.due_date && (
                          <span className={cn(task.is_overdue && "font-medium text-red-600")}>
                            {" · "}Due {formatDate(task.due_date)}
                          </span>
                        )}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-bold text-brand-600">Open tasks by priority</h2>
            <ul className="mt-3 space-y-2">
              {PRIORITIES.map((p) => (
                <li key={p} className="flex items-center justify-between text-sm">
                  <PriorityBadge priority={p} />
                  <span className="tabular-nums font-medium text-slate-700" aria-label={`${PRIORITY_META[p].label}: ${data.open_by_priority[p]}`}>
                    {data.open_by_priority[p]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-bold text-brand-600">Organization</h2>
            <p className="mt-2 text-sm text-slate-600">
              {data.member_count} member{data.member_count === 1 ? "" : "s"} ·{" "}
              <Link to="/team" className="font-medium text-brand-600 hover:text-brand-500">
                Manage team
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
