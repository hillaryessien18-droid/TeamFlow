import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { errorMessage } from "../api/client";
import { projectApi } from "../api/endpoints";
import type { Project, ProjectStatus } from "../api/types";
import { CalendarIcon, PlusIcon } from "../components/icons";
import { ConfirmDialog } from "../components/Modal";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { Alert, Button, Card, cn, EmptyState, Input, PageHeader, PageLoader, ProgressBar } from "../components/ui";
import { useOrg } from "../context/OrgContext";
import { formatDate } from "../lib/format";
import { useLoader } from "../lib/useLoader";

export function ProjectsPage() {
  const { current, canManage } = useOrg();
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      {projects.loading ? (
        <PageLoader />
      ) : projects.data?.length === 0 ? (
        <EmptyState
          title={query ? "No matching projects" : status === "active" ? "No active projects" : "No archived projects"}
          description={
            query
              ? "Try a different search."
              : status === "active"
                ? canManage
                  ? "Create your first project to start planning work on a Kanban board."
                  : "An admin or owner can create projects for this organization."
                : "Archived projects appear here. They are read-only until restored."
          }
          action={
            canManage && status === "active" && !query && (
              <Button onClick={() => setCreating(true)}>
                <PlusIcon className="size-4" /> New project
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data?.map((project) => (
            <li key={project.id}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/projects/${project.id}`} className="min-w-0 text-base font-semibold text-slate-900 hover:text-indigo-600">
                    <span className="line-clamp-2">{project.name}</span>
                  </Link>
                  {project.team_name && (
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {project.team_name}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">{project.description || "No description."}</p>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                    <span>
                      {project.completed_count} of {project.task_count} tasks done
                    </span>
                    <span className="font-medium tabular-nums text-slate-700">{project.progress}%</span>
                  </div>
                  <ProgressBar value={project.progress} label={`${project.name} progress`} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {project.due_date && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <CalendarIcon className="size-3.5" /> {formatDate(project.due_date)}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Link
                      to={`/projects/${project.id}`}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                    >
                      Open board
                    </Link>
                    {canManage && (
                      <>
                        {project.status === "active" && (
                          <Button size="sm" variant="ghost" onClick={() => setEditing(project)}>
                            Edit
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => void toggleArchive(project)}>
                          {project.status === "active" ? "Archive" : "Restore"}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setDeleting(project)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

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
