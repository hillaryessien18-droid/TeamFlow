import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { errorMessage } from "../api/client";
import { activityApi, memberApi, projectApi, taskApi } from "../api/endpoints";
import type { Priority, Task, TaskStatus } from "../api/types";
import { ActivityFeed } from "../components/ActivityFeed";
import { PlusIcon } from "../components/icons";
import { KanbanBoard } from "../components/KanbanBoard";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { TaskModal } from "../components/TaskModal";
import { Alert, Button, Card, Input, PageHeader, PageLoader, ProgressBar, Select } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import { dropPosition, groupByStatus, moveTask } from "../lib/board";
import { formatDate } from "../lib/format";
import { PRIORITIES, PRIORITY_META } from "../lib/meta";
import { useLoader } from "../lib/useLoader";

export function ProjectBoardPage() {
  const projectId = Number(useParams().projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { current, organizations, selectOrg } = useOrg();

  const project = useLoader(() => projectApi.get(projectId), [projectId]);
  const tasks = useLoader(() => taskApi.list({ project: projectId }), [projectId]);
  const orgId = project.data?.organization;
  const members = useLoader(() => (orgId ? memberApi.list(orgId) : Promise.resolve([])), [orgId]);

  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<"" | Priority>("");
  const [creatingIn, setCreatingIn] = useState<TaskStatus | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opening a project link from another organization switches to that organization.
  useEffect(() => {
    if (orgId && current && orgId !== current.id && organizations.some((o) => o.id === orgId)) selectOrg(orgId);
  }, [orgId, current, organizations, selectOrg]);

  const role = organizations.find((o) => o.id === orgId)?.my_role ?? null;
  const canManage = role === "owner" || role === "admin";
  const archived = project.data?.status === "archived";

  const openTaskId = Number(searchParams.get("task")) || null;
  const openTask = tasks.data?.find((t) => t.id === openTaskId) ?? null;
  function setOpenTask(id: number | null) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("task", String(id));
    else next.delete("task");
    setSearchParams(next, { replace: true });
  }

  const visibleTasks = useMemo(() => {
    const text = search.trim().toLowerCase();
    return (tasks.data ?? []).filter((t) => {
      if (text && !t.title.toLowerCase().includes(text) && !t.description.toLowerCase().includes(text)) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter === "me") return t.assignee === user?.id;
      if (assigneeFilter === "none") return t.assignee === null;
      if (assigneeFilter !== "all") return t.assignee === Number(assigneeFilter);
      return true;
    });
  }, [tasks.data, search, priorityFilter, assigneeFilter, user?.id]);

  const refreshProgress = () => void project.reload(true);

  async function handleMove(taskId: number, status: TaskStatus, beforeId: number | null) {
    const all = tasks.data ?? [];
    const position = dropPosition(all, taskId, status, beforeId);
    const moving = all.find((t) => t.id === taskId);
    if (!moving) return;
    const currentIndex = groupByStatus(all)[status].findIndex((t) => t.id === taskId);
    if (moving.status === status && currentIndex === position) return;

    setError(null);
    tasks.setData((prev) => prev && moveTask(prev, taskId, status, position));
    try {
      await taskApi.move(taskId, status, position);
      if (moving.status !== status) refreshProgress();
    } catch (err) {
      setError(errorMessage(err));
    }
    void tasks.reload(true);
  }

  function upsertTask(saved: Task) {
    tasks.setData((prev) => {
      if (!prev) return [saved];
      return prev.some((t) => t.id === saved.id) ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
    });
    void tasks.reload(true);
    refreshProgress();
  }

  if (project.loading) return <PageLoader />;
  if (project.error || !project.data) {
    return (
      <div className="space-y-4">
        <Alert>{project.error ?? "Project not found."}</Alert>
        <Link to="/projects" className="text-sm font-medium text-brand-600">
          ← Back to projects
        </Link>
      </div>
    );
  }
  const p = project.data;

  return (
    <>
      <nav className="mb-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-slate-700">
          Projects
        </Link>{" "}
        / <span className="text-slate-700">{p.name}</span>
      </nav>
      <PageHeader
        title={p.name}
        description={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {p.team_name && <span>Team: {p.team_name}</span>}
            {p.due_date && <span>Target: {formatDate(p.due_date)}</span>}
            <span>
              {p.completed_count}/{p.task_count} tasks complete
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowActivity((v) => !v)}>
              {showActivity ? "Hide activity" : "Activity"}
            </Button>
            {canManage && !archived && (
              <Button variant="secondary" onClick={() => setEditingProject(true)}>
                Edit project
              </Button>
            )}
            {canManage && (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const updated = archived ? await projectApi.unarchive(p.id) : await projectApi.archive(p.id);
                    project.setData(() => updated);
                  } catch (err) {
                    setError(errorMessage(err));
                  }
                }}
              >
                {archived ? "Restore project" : "Archive"}
              </Button>
            )}
            {!archived && (
              <Button onClick={() => setCreatingIn("todo")}>
                <PlusIcon className="size-4" /> New task
              </Button>
            )}
          </>
        }
      />

      {p.description && <p className="-mt-3 mb-5 max-w-3xl whitespace-pre-wrap text-sm text-slate-600">{p.description}</p>}

      <div className="mb-5 max-w-md">
        <ProgressBar value={p.progress} label="Project progress" />
        <p className="mt-1 text-xs text-slate-500">{p.progress}% complete</p>
      </div>

      {archived && (
        <div className="mb-4">
          <Alert kind="info">This project is archived and read-only. {canManage ? "Restore it to make changes." : ""}</Alert>
        </div>
      )}
      {(error || tasks.error) && (
        <div className="mb-4">
          <Alert>{error ?? tasks.error}</Alert>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          aria-label="Filter tasks"
          placeholder="Filter tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select aria-label="Filter by assignee" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="sm:w-48">
          <option value="all">Everyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {members.data
            ?.filter((m) => m.user.id !== user?.id)
            .map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.full_name}
              </option>
            ))}
        </Select>
        <Select
          aria-label="Filter by priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as "" | Priority)}
          className="sm:w-40"
        >
          <option value="">Any priority</option>
          {PRIORITIES.map((pr) => (
            <option key={pr} value={pr}>
              {PRIORITY_META[pr].label}
            </option>
          ))}
        </Select>
      </div>

      <div className={showActivity ? "grid gap-6 xl:grid-cols-[1fr_320px]" : ""}>
        {tasks.loading ? (
          <PageLoader label="Loading board…" />
        ) : (
          <KanbanBoard
            tasks={visibleTasks}
            readOnly={archived}
            onMove={handleMove}
            onOpen={(task) => setOpenTask(task.id)}
            onAdd={(status) => setCreatingIn(status)}
          />
        )}
        {showActivity && (
          <Card className="h-fit p-4">
            <h2 className="font-display text-base font-bold text-brand-600">Project activity</h2>
            <ProjectActivity projectId={p.id} version={tasks.data} />
          </Card>
        )}
      </div>

      <TaskModal
        open={creatingIn !== null || openTask !== null}
        onClose={() => {
          setCreatingIn(null);
          setOpenTask(null);
        }}
        projectId={p.id}
        task={openTask}
        initialStatus={creatingIn ?? "todo"}
        members={members.data ?? []}
        readOnly={archived}
        canManage={canManage}
        onSaved={upsertTask}
        onDeleted={(id) => {
          setOpenTask(null);
          tasks.setData((prev) => prev?.filter((t) => t.id !== id) ?? null);
          refreshProgress();
        }}
        onCommentsChanged={() => void tasks.reload(true)}
      />
      <ProjectFormModal
        open={editingProject}
        onClose={() => setEditingProject(false)}
        organizationId={p.organization}
        project={p}
        onSaved={(updated) => project.setData(() => updated)}
      />
    </>
  );
}

/** `version` changes whenever the board data changes, so the feed quietly refreshes after edits. */
function ProjectActivity({ projectId, version }: Readonly<{ projectId: number; version: unknown }>) {
  const activity = useLoader(() => activityApi.list({ project: projectId, limit: 30 }), [projectId]);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) void activity.reload(true);
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  if (activity.loading) return <PageLoader />;
  return <ActivityFeed items={activity.data ?? []} showProject={false} />;
}
