import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import type { Priority, Role, User } from "../api/types";
import { initials } from "../lib/format";
import { PRIORITY_META, ROLE_META } from "../lib/meta";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const BUTTON_VARIANTS = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-500 focus-visible:outline-brand-600",
  secondary: "bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:outline-red-600",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: "sm" | "md";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: Readonly<ButtonProps>) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: Readonly<{
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const CONTROL =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(CONTROL, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(CONTROL, "min-h-24", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn(CONTROL, "pr-8", className)} {...props} />;
});

export function Alert({ kind = "error", children }: Readonly<{ kind?: "error" | "success" | "info"; children: ReactNode }>) {
  const styles = {
    error: "bg-red-50 text-red-800 ring-red-200",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
  };
  const className = cn("rounded-md px-3 py-2 text-sm ring-1", styles[kind]);
  if (kind === "error") {
    return (
      <div role="alert" className={className}>
        {children}
      </div>
    );
  }
  return <output className={cn("block", className)}>{children}</output>;
}

export function Spinner({ className = "size-5" }: Readonly<{ className?: string }>) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = "Loading…" }: Readonly<{ label?: string }>) {
  return (
    <output className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Spinner /> {label}
    </output>
  );
}

const AVATAR_COLORS = [
  "bg-brand-100 text-brand-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

export function Avatar({ user, size = "md" }: Readonly<{ user: Pick<User, "id" | "full_name"> | null; size?: "sm" | "md" }>) {
  const dims = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";
  if (!user) {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400", dims)}>
        ?
      </span>
    );
  }
  return (
    <span
      title={user.full_name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        dims,
        AVATAR_COLORS[user.id % AVATAR_COLORS.length],
      )}
    >
      {initials(user.full_name)}
    </span>
  );
}

function Pill({ className, children }: Readonly<{ className: string; children: ReactNode }>) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: Readonly<{ priority: Priority }>) {
  return <Pill className={PRIORITY_META[priority].badge}>{PRIORITY_META[priority].label}</Pill>;
}

export function RoleBadge({ role }: Readonly<{ role: Role }>) {
  return <Pill className={ROLE_META[role].badge}>{ROLE_META[role].label}</Pill>;
}

export function ProgressBar({ value, label }: Readonly<{ value: number; label: string }>) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <progress
      aria-label={label}
      value={clamped}
      max={100}
      className={cn(
        "block h-2 w-full appearance-none overflow-hidden rounded-full border-0 bg-slate-100",
        "[&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full",
        clamped === 100
          ? "[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500"
          : "[&::-webkit-progress-value]:bg-brand-500 [&::-moz-progress-bar]:bg-brand-500",
      )}
    />
  );
}

export function Card({ className, children }: Readonly<{ className?: string; children: ReactNode }>) {
  return <div className={cn("rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80", className)}>{children}</div>;
}

export function EmptyState({
  title,
  description,
  action,
}: Readonly<{
  title: string;
  description?: string;
  action?: ReactNode;
}>) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 px-6 py-12 text-center">
      <h3 className="text-base font-bold text-brand-600">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: Readonly<{
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}>) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-600 sm:text-3xl">{title}</h1>
        {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
