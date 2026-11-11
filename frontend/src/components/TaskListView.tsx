import { useMemo } from "react";

import type { Task } from "../api/types";
import { groupByStatus } from "../lib/board";
import { formatDate } from "../lib/format";
import { STATUSES, STATUS_META } from "../lib/meta";
import { ChatIcon, PaperclipIcon } from "./icons";
import { Avatar, cn, LabelChip, PriorityBadge } from "./ui";

/** A spreadsheet-style view of the board: one table, grouped by status. */
export function TaskListView({ tasks, onOpen }: Readonly<{ tasks: Task[]; onOpen: (task: Task) => void }>) {
  const columns = useMemo(() => groupByStatus(tasks), [tasks]);

  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5">Task</th>
            <th scope="col" className="w-44 px-3 py-2.5">Assignee</th>
            <th scope="col" className="w-24 px-3 py-2.5">Priority</th>
            <th scope="col" className="w-32 px-3 py-2.5">Due</th>
          </tr>
        </thead>
        {STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const rows = columns[status];
          return (
            <tbody key={status} className="divide-y divide-slate-100">
              <tr className="bg-slate-50/40">
                <th scope="colgroup" colSpan={4} className="px-4 py-2 text-xs font-bold text-brand-600">
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", meta.dot)} />
                    {meta.label}
                    <span className="rounded-full bg-white px-2 font-medium text-slate-500 ring-1 ring-slate-200">{rows.length}</span>
                  </span>
                </th>
              </tr>
              {rows.map((task) => (
                <tr
                  key={task.id}
                  tabIndex={0}
                  onClick={() => onOpen(task)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onOpen(task);
                  }}
                  className="cursor-pointer hover:bg-brand-50/50 focus-visible:bg-brand-50 focus-visible:outline-none"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium text-slate-800", status === "completed" && "text-slate-400 line-through")}>
                        {task.title}
                      </span>
                      {task.labels.map((label) => (
                        <LabelChip key={label.id} label={label} />
                      ))}
                      {task.comment_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-400" aria-label={`${task.comment_count} comments`}>
                          <ChatIcon className="size-3.5" />
                          {task.comment_count}
                        </span>
                      )}
                      {task.attachment_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-400" aria-label={`${task.attachment_count} attachments`}>
                          <PaperclipIcon className="size-3.5" />
                          {task.attachment_count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar user={task.assignee_detail} size="sm" />
                      <span className="truncate text-slate-600">{task.assignee_detail?.full_name ?? "Unassigned"}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className={cn("px-3 py-2.5 text-slate-600", task.is_overdue && "font-medium text-red-600")}>
                    {formatDate(task.due_date) || <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs text-slate-400">
                    No tasks
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
