import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { orgApi } from "../api/endpoints";
import type { Organization, Role } from "../api/types";
import { useAuth } from "./AuthContext";

const ORG_KEY = "teamflow.organization";

interface OrgContextValue {
  organizations: Organization[];
  current: Organization | null;
  role: Role | null;
  /** Owner or admin: can manage projects, members and teams. */
  canManage: boolean;
  isOwner: boolean;
  loading: boolean;
  selectOrg: (id: number) => void;
  reload: () => Promise<Organization[]>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

function storedOrgId(): number | null {
  try {
    return Number(localStorage.getItem(ORG_KEY)) || null;
  } catch {
    return null;
  }
}

export function OrgProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(storedOrgId);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const orgs = await orgApi.list();
    setOrganizations(orgs);
    return orgs;
  }, []);

  useEffect(() => {
    if (!user) {
      setOrganizations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    reload()
      .catch(() => setOrganizations([]))
      .finally(() => setLoading(false));
  }, [user, reload]);

  const selectOrg = useCallback((id: number) => {
    setCurrentId(id);
    try {
      localStorage.setItem(ORG_KEY, String(id));
    } catch {
      // Storage unavailable: the selection just won't survive a reload.
    }
  }, []);

  const value = useMemo(() => {
    const current = organizations.find((o) => o.id === currentId) ?? organizations[0] ?? null;
    const role = current?.my_role ?? null;
    return {
      organizations,
      current,
      role,
      canManage: role === "owner" || role === "admin",
      isOwner: role === "owner",
      loading,
      selectOrg,
      reload,
    };
  }, [organizations, currentId, loading, selectOrg, reload]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) throw new Error("useOrg must be used inside <OrgProvider>");
  return context;
}
