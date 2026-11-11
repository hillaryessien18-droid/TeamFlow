import { Link, useSearchParams } from "react-router-dom";

import { searchApi } from "../api/endpoints";
import type { SearchResults } from "../api/types";
import { CalendarIcon, FolderIcon } from "../components/icons";
import { Alert, Avatar, Card, cn, EmptyState, LabelChip, PageHeader, PageLoader, PriorityBadge, ProgressBar } from "../components/ui";
import { useOrg } from "../context/OrgContext";
import { formatDate } from "../lib/format";
import { STATUS_META } from "../lib/meta";
import { useLoader } from "../lib/useLoader";

const EMPTY: SearchResults = { projects: [], tasks: [] };

export function SearchPage() {
  const { current } = useOrg();
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const results = useLoader(
    () => (current && query.length >= 2 ? searchApi.search(current.id, query) : Promise.resolve(EMPTY)),
    [current?.id, query],
  );

  if (!current) return null;

  function renderResults() {
    if (query.length < 2) {
      return <EmptyState title="Search your workspace" description="Type at least two characters in the search bar to find projects and tasks." />;
    }
    if (results.loading) return <PageLoader label="Searching…" />;
    if (results.error) return <Alert>{results.error}</Alert>;
    const { projects, tasks } = results.data ?? EMPTY;
    if (projects.length === 0 && tasks.length === 0) {
      return <EmptyState title="No matches" description={`Nothing in ${current!.name} matches "${query}". Try a different word.`} />;
    }
    return (
      <div className="space-y-6">
        {projects.length > 0 && (
          <Card>
            <h2 className="border-b border-slate-100 px-5 py-3 font-display text-base font-bold text-brand-600">
              Projects ({projects.length})
            </h2>
            <ul className="divide-y divide-slate-100">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                    <FolderIcon className="size-5 shrink-0 text-brand-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {p.name}
                        {p.status === "archived" && <span className="ml-2 text-xs font-normal text-slate-400">Archived</span>}
                      </span>
                      {p.description && <span className="block truncate text-xs text-slate-500">{p.description}</span>}
                    </span>
                    <span className="hidden w-32 sm:block">
                      <ProgressBar value={p.progress} label={`${p.name} progress`} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {tasks.length > 0 && (
          <Card>
            <h2 className="border-b border-slate-100 px-5 py-3 font-display text-base font-bold text-brand-600">
              Tasks ({tasks.length})
            </h2>
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link to={`/projects/${t.project}?task=${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-slate-50">
                    <span className={cn("size-2 shrink-0 rounded-full", STATUS_META[t.status].dot)} title={STATUS_META[t.status].label} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-semibold text-slate-900", t.status === "completed" && "text-slate-400 line-through")}>
                        {t.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {t.project_name} · {STATUS_META[t.status].label}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {t.labels.map((label) => (
                        <LabelChip key={label.id} label={label} />
                      ))}
                      <PriorityBadge priority={t.priority} />
                    </span>
                    {t.due_date && (
                      <span className={cn("inline-flex items-center gap-1 text-xs text-slate-500", t.is_overdue && "font-medium text-red-600")}>
                        <CalendarIcon className="size-3.5" />
                        {formatDate(t.due_date)}
                      </span>
                    )}
                    <Avatar user={t.assignee_detail} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Search" description={query ? <>Results for "{query}" in {current.name}</> : `Find anything in ${current.name}`} />
      {renderResults()}
    </>
  );
}
