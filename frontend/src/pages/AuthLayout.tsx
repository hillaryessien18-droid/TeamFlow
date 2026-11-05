import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { CheckIcon, Logo } from "../components/icons";

const HIGHLIGHTS = [
  "Kanban boards with drag-and-drop",
  "Deadlines, priorities and assignees",
  "Comments and full activity history",
  "Owner, Admin and Member roles",
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-8">
        <Link to="/welcome" aria-label="TeamFlow home" className="self-start">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-600">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">{children}</div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-brand-600 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-500/40 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Project management for teams</p>
          <p className="mt-4 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white">
            Plan the work.
            <br />
            <em className="text-emerald-300">Ship together.</em>
          </p>
          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-brand-50">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                  <CheckIcon className="size-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-12 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-emerald-400/20 text-lg">✅</span>
              <div className="text-sm">
                <p className="font-semibold text-white">“Homepage copy” moved to Completed</p>
                <p className="text-brand-200">Website redesign · just now</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
