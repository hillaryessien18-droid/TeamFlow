import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import { ClockIcon, CogIcon, FolderIcon, HomeIcon, Logo, LogoutIcon, MenuIcon, SearchIcon, UserIcon, UsersIcon } from "./icons";
import { NotificationBell } from "./NotificationBell";
import { OrgFormFields, OrgFormModal } from "./OrgFormModal";
import { Avatar, Card, cn, PageLoader, RoleBadge } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: HomeIcon, end: true },
  { to: "/projects", label: "Projects", icon: FolderIcon, end: false },
  { to: "/team", label: "Members & Teams", icon: UsersIcon, end: false },
  { to: "/activity", label: "Activity", icon: ClockIcon, end: false },
  { to: "/settings", label: "Settings", icon: CogIcon, end: false },
];

function Sidebar({ onCreateOrg }: Readonly<{ onCreateOrg: () => void }>) {
  const { user, logout } = useAuth();
  const { organizations, current, selectOrg } = useOrg();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col gap-6 bg-brand-600 px-4 py-5 text-brand-100">
      <Logo className="px-2" tone="light" />

      {current && (
        <div className="space-y-1.5">
          <label htmlFor="org-switcher" className="px-2 text-xs font-semibold uppercase tracking-wider text-brand-300">
            Organization
          </label>
          <select
            id="org-switcher"
            value={current.id}
            onChange={(event) => {
              if (event.target.value === "new") {
                onCreateOrg();
                return;
              }
              selectOrg(Number(event.target.value));
              navigate("/");
            }}
            className="block w-full rounded-lg border-0 bg-white/10 py-2 pl-3 pr-8 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 focus:ring-2 focus:ring-emerald-300 [&>option]:text-slate-900"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
            <option value="new">+ New organization…</option>
          </select>
          {current.my_role && (
            <div className="flex items-center gap-2 px-2 text-xs text-brand-200">
              Your role: <RoleBadge role={current.my_role} />
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-1" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                isActive ? "bg-white text-brand-600 shadow-sm" : "text-brand-100 hover:bg-white/10 hover:text-white",
              )
            }
          >
            <Icon className="size-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 pt-4">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn("flex items-center gap-3 rounded-lg px-2 py-2", isActive ? "bg-white/15" : "hover:bg-white/10")
          }
        >
          <Avatar user={user} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{user?.full_name}</span>
            <span className="block truncate text-xs text-brand-300">{user?.email}</span>
          </span>
          <UserIcon className="ml-auto size-4 text-brand-300" />
        </NavLink>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-100 hover:bg-white/10 hover:text-white"
        >
          <LogoutIcon className="size-5" /> Log out
        </button>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const onSearchPage = location.pathname === "/search";
  const [text, setText] = useState(onSearchPage ? (searchParams.get("q") ?? "") : "");

  // Keep the box in sync when the search page's query changes, and clear it elsewhere.
  useEffect(() => {
    setText(onSearchPage ? (searchParams.get("q") ?? "") : "");
  }, [onSearchPage, searchParams]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = text.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full max-w-md">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        aria-label="Search projects and tasks"
        placeholder="Search projects and tasks…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="block w-full rounded-lg border-0 bg-slate-100/80 py-2 pl-9 pr-3 text-sm text-slate-900 ring-1 ring-inset ring-transparent placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-600"
      />
    </form>
  );
}

function Onboarding() {
  const { user } = useAuth();
  const { reload, selectOrg } = useOrg();
  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-brand-600">Welcome, {user?.full_name.split(" ")[0]} 👋</h1>
      <p className="mt-2 text-sm text-slate-600">
        Create an organization to start managing projects. You'll be its owner and can invite teammates by email. If a
        teammate already added you to theirs, it will show up here once they do.
      </p>
      <Card className="mt-6 p-5">
        <OrgFormFields
          onSaved={async (org) => {
            await reload();
            selectOrg(org.id);
          }}
        />
      </Card>
    </div>
  );
}

export function Layout() {
  const { organizations, loading, reload, selectOrg } = useOrg();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  function renderMain() {
    if (loading) return <PageLoader />;
    if (organizations.length === 0) return <Onboarding />;
    return <Outlet />;
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar onCreateOrg={() => setCreatingOrg(true)} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            className="absolute inset-0 cursor-default bg-slate-900/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">
            <Sidebar onCreateOrg={() => setCreatingOrg(true)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <MenuIcon />
          </button>
          <Logo className="hidden sm:inline-flex lg:hidden" />
          {organizations.length > 0 && (
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
              <GlobalSearch />
              <NotificationBell />
            </div>
          )}
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {renderMain()}
        </main>
      </div>

      <OrgFormModal
        open={creatingOrg}
        onClose={() => setCreatingOrg(false)}
        onSaved={async (org) => {
          await reload();
          selectOrg(org.id);
          setCreatingOrg(false);
          navigate("/");
        }}
      />
    </div>
  );
}
