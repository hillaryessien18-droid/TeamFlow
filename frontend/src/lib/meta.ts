import type { LabelColor, Priority, Role, TaskStatus } from "../api/types";

export const STATUSES: TaskStatus[] = ["todo", "in_progress", "completed"];
export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];
export const ROLES: Role[] = ["owner", "admin", "member"];

export const STATUS_META: Record<TaskStatus, { label: string; dot: string; bar: string }> = {
  todo: { label: "To Do", dot: "bg-slate-400", bar: "bg-slate-300" },
  in_progress: { label: "In Progress", dot: "bg-amber-500", bar: "bg-amber-400" },
  completed: { label: "Completed", dot: "bg-emerald-500", bar: "bg-emerald-500" },
};

export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  urgent: { label: "Urgent", badge: "bg-red-50 text-red-700 ring-red-600/20" },
  high: { label: "High", badge: "bg-orange-50 text-orange-700 ring-orange-600/20" },
  medium: { label: "Medium", badge: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  low: { label: "Low", badge: "bg-slate-50 text-slate-600 ring-slate-500/20" },
};

export const ROLE_META: Record<Role, { label: string; badge: string }> = {
  owner: { label: "Owner", badge: "bg-brand-50 text-brand-700 ring-brand-600/20" },
  admin: { label: "Admin", badge: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  member: { label: "Member", badge: "bg-slate-50 text-slate-600 ring-slate-500/20" },
};

export const LABEL_COLORS: LabelColor[] = ["slate", "red", "orange", "amber", "emerald", "sky", "violet", "rose"];

export const LABEL_META: Record<LabelColor, { chip: string; swatch: string }> = {
  slate: { chip: "bg-slate-100 text-slate-700 ring-slate-500/20", swatch: "bg-slate-400" },
  red: { chip: "bg-red-50 text-red-700 ring-red-600/20", swatch: "bg-red-500" },
  orange: { chip: "bg-orange-50 text-orange-700 ring-orange-600/20", swatch: "bg-orange-500" },
  amber: { chip: "bg-amber-50 text-amber-800 ring-amber-600/20", swatch: "bg-amber-500" },
  emerald: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", swatch: "bg-emerald-500" },
  sky: { chip: "bg-sky-50 text-sky-700 ring-sky-600/20", swatch: "bg-sky-500" },
  violet: { chip: "bg-violet-50 text-violet-700 ring-violet-600/20", swatch: "bg-violet-500" },
  rose: { chip: "bg-rose-50 text-rose-700 ring-rose-600/20", swatch: "bg-rose-500" },
};

/** Accent colors for projects, picked from the project id so each project keeps its color. */
const PROJECT_COLORS = ["bg-sky-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-teal-500"];

export function projectColor(id: number): string {
  return PROJECT_COLORS[id % PROJECT_COLORS.length];
}
