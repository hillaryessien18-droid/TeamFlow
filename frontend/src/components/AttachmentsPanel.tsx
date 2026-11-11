import { useRef, useState, type DragEvent } from "react";

import { errorMessage } from "../api/client";
import { attachmentApi } from "../api/endpoints";
import type { Attachment } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { relativeTime } from "../lib/format";
import { useLoader } from "../lib/useLoader";
import { PaperclipIcon } from "./icons";
import { Alert, Button, cn, PageLoader } from "./ui";

const MAX_MB = 10;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  taskId: number;
  readOnly: boolean;
  canModerate: boolean;
  onChange?: () => void;
}

export function AttachmentsPanel({ taskId, readOnly, canModerate, onChange }: Readonly<Props>) {
  const { user } = useAuth();
  const attachments = useLoader(() => attachmentApi.list(taskId), [taskId]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const tooBig = [...files].find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than ${MAX_MB} MB.`);
      return;
    }
    setUploading(true);
    try {
      for (const file of files) await attachmentApi.upload(taskId, file);
      await attachments.reload(true);
      onChange?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(attachment: Attachment) {
    setError(null);
    try {
      await attachmentApi.remove(attachment.id);
      attachments.setData((prev) => prev?.filter((a) => a.id !== attachment.id) ?? null);
      onChange?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function download(attachment: Attachment) {
    setError(null);
    try {
      await attachmentApi.download(attachment);
    } catch (err) {
      setError(errorMessage(err, "Couldn't download that file."));
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!readOnly) void upload(event.dataTransfer.files);
  }

  if (attachments.loading) return <PageLoader label="Loading files…" />;

  return (
    <div className="space-y-4">
      {(error || attachments.error) && <Alert>{error ?? attachments.error}</Alert>}
      {!readOnly && (
        <section
          aria-label="Upload files"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm transition",
            dragging ? "border-brand-400 bg-brand-50" : "border-slate-200",
          )}
        >
          <PaperclipIcon className="size-5 text-slate-400" />
          <p className="text-slate-500">Drag files here, or</p>
          <input ref={inputRef} type="file" multiple className="sr-only" id={`attach-${taskId}`} onChange={(e) => void upload(e.target.files)} />
          <Button size="sm" variant="secondary" loading={uploading} onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
          <p className="text-xs text-slate-400">Up to {MAX_MB} MB each</p>
        </section>
      )}
      {attachments.data?.length === 0 && <p className="text-sm text-slate-500">No files attached yet.</p>}
      <ul className="divide-y divide-slate-100">
        {attachments.data?.map((a) => {
          const canDelete = !readOnly && (canModerate || a.uploaded_by?.id === user?.id);
          return (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                {a.name.includes(".") ? a.name.split(".").pop()!.slice(0, 4) : "file"}
              </span>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => void download(a)} className="block max-w-full truncate text-left text-sm font-medium text-brand-600 hover:underline">
                  {a.name}
                </button>
                <p className="truncate text-xs text-slate-500">
                  {formatBytes(a.size)} · {a.uploaded_by?.full_name ?? "A former member"} · {relativeTime(a.created_at)}
                </p>
              </div>
              {canDelete && (
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => void remove(a)}>
                  Remove
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
