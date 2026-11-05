import { useState, type FormEvent } from "react";

import { errorMessage } from "../api/client";
import { commentApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { relativeTime } from "../lib/format";
import { useLoader } from "../lib/useLoader";
import { Alert, Avatar, Button, PageLoader, Textarea } from "./ui";

interface Props {
  taskId: number;
  readOnly: boolean;
  canModerate: boolean;
  onChange?: () => void;
}

export function CommentsPanel({ taskId, readOnly, canModerate, onChange }: Props) {
  const { user } = useAuth();
  const comments = useLoader(() => commentApi.list(taskId), [taskId]);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await comments.reload(true);
      onChange?.();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    if (await run(() => commentApi.create(taskId, body))) setBody("");
  }

  if (comments.loading) return <PageLoader label="Loading comments…" />;

  return (
    <div className="space-y-4">
      {(error || comments.error) && <Alert>{error ?? comments.error}</Alert>}
      {comments.data?.length === 0 && <p className="text-sm text-slate-500">No comments yet. Start the discussion.</p>}
      <ul className="space-y-4">
        {comments.data?.map((comment) => {
          const mine = comment.author.id === user?.id;
          return (
            <li key={comment.id} className="flex gap-3">
              <Avatar user={comment.author} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-medium text-slate-900">{comment.author.full_name}</span>
                  <time className="text-slate-500" dateTime={comment.created_at}>
                    {relativeTime(comment.created_at)}
                    {new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 1000 && " (edited)"}
                  </time>
                  {!readOnly && (mine || canModerate) && editing?.id !== comment.id && (
                    <span className="ml-auto flex gap-2">
                      {mine && (
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-900"
                          onClick={() => setEditing({ id: comment.id, body: comment.body })}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => void run(() => commentApi.remove(comment.id))}
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>
                {editing?.id === comment.id ? (
                  <div className="mt-1 space-y-2">
                    <Textarea
                      aria-label="Edit comment"
                      value={editing.body}
                      onChange={(e) => setEditing({ id: comment.id, body: e.target.value })}
                      className="min-h-16"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={busy}
                        onClick={async () => {
                          if (await run(() => commentApi.update(comment.id, editing.body))) setEditing(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{comment.body}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            aria-label="New comment"
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-16"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
              Comment
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
