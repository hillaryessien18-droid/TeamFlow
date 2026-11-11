import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { errorMessage } from "../api/client";
import { projectApi } from "../api/endpoints";
import type { Project, ProjectStatus } from "../api/types";
import { CalendarIcon, PlusIcon } from "../components/icons";
import { ConfirmDialog } from "../components/Modal";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { Alert, Button, Card, cn, EmptyState, Input, PageHeader, PageLoader, ProgressBar } from "../components/ui";
import { useOrg } from "../context/OrgContext";
import { formatDate, parseDate, todayISO } from "../lib/format";
import { projectColor } from "../lib/meta";
import { useLoader } from "../lib/useLoader";

function emptyStateCopy(query: string, status: ProjectStatus, canManage: boolean) {
  if (query) return { title: "No matching projects", description: "Try a different search." };
  if (status === "archived") {
    return {
      title: "No archived projects",
      description: "Archived projects appear here. They are read-only until restored.",
    };
  }
  return {
    title: "No active projects",
    description: canManage
      ? "Create your first project to start planning work on a Kanban board."
      : "An admin or owner can create projects for this organization.",
  };
}

/** A delivery-health status like the ones real project tools show next to each project. */
function projectHealth(project: Project): { label: string; className: string } | null {
  if (project.status === "archived") return { label: "Archived", className: "bg-slate-100 text-slate-600" };
  if (project.task_count > 0 && project.progress === 100) return { label: "Complete", className: "bg-emerald-50 text-emerald-700" };
  if (!project.due_date) return null;
  const daysLeft = Math.round((parseDate(project.due_date).getTime() - parseDate(todayISO()).getTime()) / 86_400_000);
  if (daysLeft < 0) return { label: "Overdue", className: "bg-red-50 text-red-700" };
  if (daysLeft <= 7) return { label: "Due soon", className: "bg-amber-50 text-amber-800" };
  return { label: "On track", className: "bg-emerald-50 text-emerald-700" };
}

interface ProjectCardProps {
  project: Project;
  canManage: boolean;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

function ProjectCard({ project, canManage, onEdit, onToggleArchive, onDelete }: Readonly<ProjectCardProps>) {
  const active = project.status === "active";
  const health = projectHealth(project);
  return (
    <Card className="flex h-full flex-col p-5 transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-base font-bold text-white",
            projectColor(project.id),
          )}
        >
          {project.name.trim()[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/projects/${project.id}`} className="text-base font-semibold text-slate-900 hover:text-brand-600">
            <span className="line-clamp-1">{project.name}</span>
          </Link>
          <p className="text-xs text-slate-500">{project.team_name ? `${project.team_name} team` : "No team"}</p>
        </div>
        {health && (
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", health.className)}>{health.label}</span>
        )}
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-600">{project.description || "No description."}</p>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-slate-500">
          <span>
            {project.task_count - project.completed_count} open · {project.completed_count} of {project.task_count} done
          </span>
          <span className="font-medium tabular-nums text-slate-700">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} label={`${project.name} progress`} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {project.due_date && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <CalendarIcon className="size-3.5" /> Due {formatDate(project.due_date)}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <Link
            to={`/projects/${project.id}`}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            Open board
          </Link>
          {canManage && (
            <>
              {active && (
                <Button size="sm" variant="ghost" onClick={onEdit}>
                  Edit
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onToggleArchive}>
                {active ? "Archive" : "Restore"}
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onDelete}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ProjectsPage() {
  const { current, canManage } = useOrg();
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The sidebar's "+" links here with ?new=1 to open the create dialog.
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    if (canManage) setCreating(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, canManage]);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const projects = useLoader(
    () => projectApi.list({ organization: current!.id, status, search: query }),
    [current?.id, status, query],
  );

  async function toggleArchive(project: Project) {
    setError(null);
    try {
      await (project.status === "active" ? projectApi.archive(project.id) : projectApi.unarchive(project.id));
      await projects.reload(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!current) return null;

  function renderProjects() {
    if (projects.loading) return <PageLoader />;
    if (projects.data?.length === 0) {
      const copy = emptyStateCopy(query, status, canManage);
      return (
        <EmptyState
          title={copy.title}
          description={copy.description}
          action={
            canManage && status === "active" && !query && (
              <Button onClick={() => setCreating(true)}>
                <PlusIcon className="size-4" /> New project
              </Button>
            )
          }
        />
      );
    }
    return (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.data?.map((project) => (
          <li key={project.id}>
            <ProjectCard
              project={project}
              canManage={canManage}
              onEdit={() => setEditing(project)}
              onToggleArchive={() => void toggleArchive(project)}
              onDelete={() => setDeleting(project)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description={canManage ? "Create, edit and archive your organization's projects." : "Projects in your organization."}
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon className="size-4" /> New project
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Project status" className="inline-flex rounded-lg bg-slate-100 p-1">
          {(["active", "archived"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              type="button"
              aria-selected={status === s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition",
                status === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <Input
          type="search"
          aria-label="Search projects"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      {(error || projects.error) && (
        <div className="mb-4">
          <Alert>{error ?? projects.error}</Alert>
        </div>
      )}

      {renderProjects()}

      <ProjectFormModal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        organizationId={current.id}
        project={editing}
        onSaved={() => void projects.reload(true)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete project?"
        message={
          <>
            <strong>{deleting?.name}</strong> and all of its tasks and comments will be permanently deleted. Consider
            archiving it instead if you may need it later.
          </>
        }
        onConfirm={async () => {
          await projectApi.remove(deleting!.id);
          await projects.reload(true);
        }}
      />
    </>
  );
}
