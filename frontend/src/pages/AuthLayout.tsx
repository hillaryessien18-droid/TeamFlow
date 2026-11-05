import type { ReactNode } from "react";

import { Logo } from "../components/icons";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-8 text-lg" />
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">{children}</div>
      </div>
    </div>
  );
}
