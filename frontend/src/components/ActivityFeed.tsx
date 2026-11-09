import { Link } from "react-router-dom";

import type { Activity } from "../api/types";
import { relativeTime } from "../lib/format";
import { Avatar } from "./ui";

export function ActivityFeed({ items, showProject = true }: Readonly<{ items: Activity[]; showProject?: boolean }>) {
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-500">No activity yet.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-3">
          <Avatar user={item.actor} size="sm" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-slate-700">
              <span className="font-medium text-slate-900">{item.actor?.full_name ?? "Someone"}</span> {item.message}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()}>
                {relativeTime(item.created_at)}
              </time>
              {showProject && item.project && item.project_name && (
                <>
                  {" · "}
                  <Link to={`/projects/${item.project}`} className="hover:text-brand-600 hover:underline">
                    {item.project_name}
                  </Link>
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
