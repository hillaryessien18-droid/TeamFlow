import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { errorMessage } from "../api/client";
import { notificationApi } from "../api/endpoints";
import type { Notification } from "../api/types";
import { useOrg } from "../context/OrgContext";
import { relativeTime } from "../lib/format";
import { BellIcon } from "./icons";
import { Alert, Avatar, cn, Spinner } from "./ui";

const POLL_MS = 30_000;

export function NotificationBell() {
  const navigate = useNavigate();
  const { organizations, current, selectOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    notificationApi
      .unreadCount()
      .then(setUnread)
      .catch(() => {
        // Keep the last known count; the next poll will try again.
      });
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refreshCount();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    notificationApi
      .list({ limit: 30 })
      .then(setItems)
      .catch((err) => setError(errorMessage(err)));

    function onPointer(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openItem(item: Notification) {
    setOpen(false);
    if (!item.is_read) {
      setUnread((n) => Math.max(0, n - 1));
      setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)) ?? null);
      void notificationApi.markRead(item.id).catch(() => refreshCount());
    }
    if (item.organization && item.organization !== current?.id && organizations.some((o) => o.id === item.organization)) {
      selectOrg(item.organization);
    }
    if (item.link) navigate(item.link);
  }

  async function markAllRead() {
    setUnread(0);
    setItems((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? null);
    try {
      await notificationApi.markAllRead();
    } catch (err) {
      setError(errorMessage(err));
      refreshCount();
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-display text-sm font-bold text-brand-600">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="text-xs font-semibold text-brand-600 hover:text-brand-500">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="p-3">
                <Alert>{error}</Alert>
              </div>
            )}
            {!items && !error && (
              <div className="flex justify-center py-8 text-slate-400">
                <Spinner />
              </div>
            )}
            {items?.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</p>}
            <ul>
              {items?.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50",
                      !item.is_read && "bg-brand-50/60",
                    )}
                  >
                    <Avatar user={item.actor} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-700">
                        <strong className="font-semibold text-slate-900">{item.actor?.full_name ?? "TeamFlow"}</strong>{" "}
                        {item.message}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {relativeTime(item.created_at)}
                        {item.organization_name && ` · ${item.organization_name}`}
                      </span>
                    </span>
                    {!item.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
