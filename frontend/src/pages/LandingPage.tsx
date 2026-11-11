import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { ArrowRightIcon, CheckIcon, Logo, MenuIcon } from "../components/icons";
import { cn } from "../components/ui";

const REPO_URL = "https://github.com/hillaryessien18-droid/TeamFlow";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#roles", label: "Roles" },
  { href: "#dashboard", label: "Dashboard" },
];

function Eyebrow({ children, light = false }: Readonly<{ children: ReactNode; light?: boolean }>) {
  return (
    <p className={cn("text-xs font-bold uppercase tracking-[0.18em]", light ? "text-emerald-300" : "text-emerald-600")}>
      {children}
    </p>
  );
}

function Check({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckIcon className="size-3" />
      </span>
      <span className="text-slate-600">{children}</span>
    </li>
  );
}

/* ---------- Product mockups (pure HTML, no screenshots needed) ---------- */

function MiniCard({ title, badge, badgeClass, person, done = false }: Readonly<{
  title: string;
  badge: string;
  badgeClass: string;
  person: string;
  done?: boolean;
}>) {
  return (
    <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200 sm:p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className={cn("min-w-0 wrap-break-word text-[11px] font-semibold leading-snug text-slate-800", done && "text-slate-400 line-through")}>{title}</p>
        <span className={cn("hidden shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold sm:inline", badgeClass)}>{badge}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">{done ? "✓ Done" : "📅 Fri"}</span>
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-100 text-[8px] font-bold text-brand-600">
          {person}
        </span>
      </div>
    </div>
  );
}

function BoardMockup() {
  const columns = [
    {
      name: "To Do",
      dot: "bg-slate-400",
      cards: [
        <MiniCard key="1" title="Plan launch email" badge="Medium" badgeClass="bg-sky-50 text-sky-700" person="MM" />,
        <MiniCard key="2" title="Accessibility review" badge="Urgent" badgeClass="bg-red-50 text-red-700" person="AA" />,
      ],
    },
    {
      name: "In Progress",
      dot: "bg-amber-500",
      cards: [<MiniCard key="3" title="Design navigation" badge="High" badgeClass="bg-orange-50 text-orange-700" person="MM" />],
    },
    {
      name: "Completed",
      dot: "bg-emerald-500",
      cards: [
        <MiniCard key="4" title="Homepage copy" badge="High" badgeClass="bg-orange-50 text-orange-700" person="DD" done />,
        <MiniCard key="5" title="Analytics audit" badge="Low" badgeClass="bg-slate-100 text-slate-600" person="AA" done />,
      ],
    },
  ];
  return (
    <div className="rounded-2xl bg-white p-3 shadow-2xl shadow-brand-900/20 ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Project</p>
          <p className="font-display text-sm font-bold text-brand-600">Website redesign</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">40% done</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {columns.map((col) => (
          <div key={col.name} className="min-w-0 rounded-xl bg-slate-100/80 p-1.5 sm:p-2">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
              <span className={cn("size-1.5 rounded-full", col.dot)} />
              {col.name}
            </p>
            <div className="space-y-2">{col.cards}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityMockup() {
  const items = [
    { who: "MM", text: "moved “Design navigation” to In Progress", time: "2m", icon: "🔀" },
    { who: "AA", text: "assigned “Accessibility review” to Adam", time: "18m", icon: "👤" },
    { who: "DD", text: "completed “Homepage copy”", time: "1h", icon: "✅" },
    { who: "OO", text: "commented on “Plan launch email”", time: "3h", icon: "💬" },
  ];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-xl shadow-brand-900/10 ring-1 ring-slate-200">
      <p className="mb-3 font-display text-sm font-bold text-brand-600">Recent activity</p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.text} className="flex items-center gap-3">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm">{item.icon}</span>
            <p className="min-w-0 flex-1 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{item.who}</span> {item.text}
            </p>
            <span className="text-[10px] text-slate-400">{item.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskMockup() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-xl shadow-brand-900/10 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-sm font-bold text-brand-600">Design new navigation</p>
        <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">High</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        {[
          ["Status", "In Progress"],
          ["Assignee", "Mia M."],
          ["Deadline", "Fri, Nov 8"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 p-2">
            <dt className="text-slate-400">{k}</dt>
            <dd className="font-semibold text-slate-700">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-700">AA</span>
          <p className="rounded-lg rounded-tl-none bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
            Can we keep search in the header on mobile?
          </p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">MM</span>
          <p className="rounded-lg rounded-tl-none bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
            Yes — two options coming Thursday.
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  const stats = [
    ["Active projects", "2", "📁"],
    ["Open tasks", "8", "📝"],
    ["Completion", "27%", "📈"],
    ["Overdue", "1", "⏰"],
  ];
  const projects = [
    ["Website redesign", 40],
    ["Mobile app MVP", 25],
  ] as const;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-2xl shadow-black/30 ring-1 ring-white/10">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, value, icon]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-2.5">
            <p className="text-sm">{icon}</p>
            <p className="mt-1 font-display text-lg font-bold text-brand-600">{value}</p>
            <p className="text-[10px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {projects.map(([name, pct]) => (
          <div key={name}>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="font-semibold text-slate-700">{name}</span>
              <span className="text-slate-500">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

const FEATURES = [
  { icon: "🗂️", title: "Kanban boards", text: "Drag tasks between To Do, In Progress and Completed. The order is saved for everyone." },
  { icon: "👥", title: "Organizations & teams", text: "Create organizations, add teammates by email and group them into teams." },
  { icon: "🎯", title: "Assign & prioritize", text: "Give every task an owner and a priority from Low to Urgent." },
  { icon: "📅", title: "Deadlines", text: "Set due dates on tasks and projects. Overdue work is flagged automatically." },
  { icon: "💬", title: "Comments", text: "Discuss work right on the task instead of in scattered chat threads." },
  { icon: "🕓", title: "Activity history", text: "A complete audit trail of who changed what, and when." },
  { icon: "🔐", title: "Role-based access", text: "Owner, Admin and Member roles, enforced on every request." },
  { icon: "🗄️", title: "Archive projects", text: "Finished projects become read-only but stay searchable." },
  { icon: "📊", title: "Progress dashboard", text: "Completion rates, workload by priority, and your own open tasks." },
];

const STEPS = [
  { title: "Create your organization", text: "Sign up free and create an organization. You become its owner." },
  { title: "Invite your team", text: "Add teammates by email, choose their roles and group them into teams." },
  { title: "Plan on the board", text: "Create projects, add tasks with deadlines and priorities, and drag them to done." },
];

const ROLES = [
  {
    name: "Owner",
    tone: "bg-brand-600 text-white",
    points: ["Everything an admin can do", "Grant or revoke the owner role", "Delete the organization"],
  },
  {
    name: "Admin",
    tone: "bg-violet-100 text-violet-800",
    points: ["Create, edit, archive and delete projects", "Add and remove members", "Manage teams and organization settings"],
  },
  {
    name: "Member",
    tone: "bg-slate-100 text-slate-700",
    points: ["See every project in the organization", "Create, update and move tasks", "Comment and follow the activity"],
  },
];

function FeatureBlock({ eyebrow, title, points, mockup, reverse = false }: Readonly<{
  eyebrow: string;
  title: string;
  points: string[];
  mockup: ReactNode;
  reverse?: boolean;
}>) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn(reverse && "lg:order-2")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-brand-600 sm:text-3xl">{title}</h3>
        <ul className="mt-6 space-y-3 text-sm sm:text-base">
          {points.map((p) => (
            <Check key={p}>{p}</Check>
          ))}
        </ul>
      </div>
      <div className={cn("mx-auto w-full max-w-lg", reverse && "lg:order-1")}>{mockup}</div>
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="overflow-x-clip bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/welcome" aria-label="TeamFlow home">
            <Logo />
          </Link>
          <nav className="hidden flex-1 items-center gap-6 md:flex" aria-label="Sections">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium text-slate-600 hover:text-brand-600">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50">
              Log in
            </Link>
            <Link to="/register" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500">
              Get started free
            </Link>
          </div>
          <button
            type="button"
            className="ml-auto rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MenuIcon />
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-slate-100 px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Sections">
              {NAV.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {item.label}
                </a>
              ))}
              <Link to="/login" className="rounded-md px-2 py-2 text-sm font-semibold text-brand-600">
                Log in
              </Link>
              <Link to="/register" className="mt-1 rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white">
                Get started free
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-linear-to-b from-brand-50 to-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
            <div>
              <Eyebrow>Project management for teams</Eyebrow>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-brand-600 sm:text-5xl lg:text-6xl">
                Plan the work.
                <br />
                Track the progress.
                <br />
                <em className="text-emerald-500">Ship together.</em>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-slate-600">
                TeamFlow puts your organization, projects and tasks in one place. Kanban boards, deadlines, comments and
                role-based access keep everyone on the same page.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500"
                >
                  Create a free account <ArrowRightIcon className="size-4" />
                </Link>
                <Link to="/login" className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-600 ring-1 ring-brand-200 hover:bg-brand-50">
                  Log in
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-500">Free to use · Unlimited projects · Open source</p>
            </div>
            <div className="relative min-w-0">
              <div className="absolute -inset-6 z-0 rounded-4xl bg-brand-200/40 blur-2xl" aria-hidden="true" />
              <div className="relative">
                <BoardMockup />
              </div>
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section id="features" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>Features</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-600 sm:text-4xl">Everything your team needs to deliver</h2>
              <p className="mt-4 text-slate-600">From the first idea to the last task done, without the spreadsheet chaos.</p>
            </div>
            <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-2xl bg-canvas p-6 ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-slate-200">
                    {f.icon}
                  </span>
                  <h3 className="mt-4 font-bold text-brand-600">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Alternating feature blocks */}
        <section className="bg-canvas py-20">
          <div className="mx-auto max-w-7xl space-y-24 px-4 sm:px-6 lg:px-8">
            <FeatureBlock
              eyebrow="Collaboration"
              title="Every conversation lives on the task"
              points={[
                "Comment on any task. Edit your own comments, while admins can moderate.",
                "Assign owners, set priorities and deadlines in one place",
                "A full history tab shows every change to the task",
              ]}
              mockup={<TaskMockup />}
            />
            <FeatureBlock
              reverse
              eyebrow="Transparency"
              title="Always know what changed"
              points={[
                "Organization-wide activity feed, filterable by project",
                "Moves, assignments, deadline changes and comments are all logged",
                "History is kept even after tasks or projects are deleted",
              ]}
              mockup={<ActivityMockup />}
            />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-600 sm:text-4xl">Up and running in minutes</h2>
            </div>
            <ol className="mt-14 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-600 font-display text-base font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-bold text-brand-600">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="scroll-mt-20 bg-canvas py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>Role-based access</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-600 sm:text-4xl">The right access for everyone</h2>
              <p className="mt-4 text-slate-600">Permissions are enforced by the API, not just hidden in the interface.</p>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {ROLES.map((role) => (
                <div key={role.name} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-bold", role.tone)}>{role.name}</span>
                  <ul className="mt-5 space-y-3 text-sm">
                    {role.points.map((p) => (
                      <Check key={p}>{p}</Check>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard */}
        <section id="dashboard" className="scroll-mt-20 bg-brand-600 py-20 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <Eyebrow light>Dashboard</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">See progress at a glance</h2>
              <p className="mt-4 text-brand-100">
                One screen shows how your organization is doing: active projects, open and overdue tasks, completion
                rate, and the work assigned to you.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-brand-50">
                {["Progress bar for every active project", "Open tasks broken down by priority", "Your own open tasks, sorted by deadline"].map((p) => (
                  <li key={p} className="flex gap-3">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                      <CheckIcon className="size-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <DashboardMockup />
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-brand-600 sm:text-4xl">
              Ready to get your team <em className="text-emerald-500">in flow?</em>
            </h2>
            <p className="mt-4 text-slate-600">Create your organization in under a minute. No credit card, no setup.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500">
                Get started free <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-brand-900 text-brand-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <Logo tone="light" />
            <p className="mt-3 max-w-sm text-sm text-brand-300">
              Project management for teams: organizations, Kanban boards, tasks, comments and role-based access.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Account</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/register" className="hover:text-white">Sign up</Link></li>
              <li><Link to="/login" className="hover:text-white">Log in</Link></li>
              <li><Link to="/forgot-password" className="hover:text-white">Reset password</Link></li>
              <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-brand-300 sm:px-6 lg:px-8">
            © {new Date().getFullYear()} TeamFlow · Built with Django REST Framework, React and PostgreSQL.
          </p>
        </div>
      </footer>
    </div>
  );
}
