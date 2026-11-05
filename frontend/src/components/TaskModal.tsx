import { useState, type FormEvent } from "react";

import { errorMessage } from "../api/client";
import { activityApi, taskApi } from "../api/endpoints";
import type { Membership, Priority, Task, TaskStatus } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../lib/format";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "../lib/meta";
import { useLoader } from "../lib/useLoader";
import { ActivityFeed } from "./ActivityFeed";
import { CommentsPanel } from "./CommentsPanel";
import { ConfirmDialog, Modal } from "./Modal";
import { Alert, Button, cn, Field, Input, PageLoader, Select, Textarea } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  /** Existing task to edit; omit to create a new one. */
  task?: Task | null;
  initialStatus?: TaskStatus;
  members: Membership[];
  readOnly: boolean;
  canManage: boolean;
  onSaved: (task: Task) => void;
  onDeleted: (taskId: number) => void;
  onCommentsChanged?: () => void;
}

export function TaskModal(props: Props) {
  const { open, onClose, task } = props;
  return (
    <Modal open={open} onClose={onClose} title={task ? "Task details" : "New task"} size={task ? "lg" : "md"}>
      {/* Re-mount per task so the form always starts from that task's values. */}
      <TaskModalBody key={task?.id ?? `new-${props.initialStatus}`} {...props} />
    </Modal>
  );
}

function TaskModalBody({
  onClose,
  projectId,
  task,
  initialStatus = "todo",
  members,
  readOnly,
  canManage,
  onSaved,
  onDeleted,
  onCommentsChanged,
}: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? initialStatus);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [assignee, setAssignee] = useState<string>(task?.assignee ? String(task.assignee) : "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<"comments" | "activity">("comments");

  const canDelete = !readOnly && task && (canManage || task.created_by?.id === user?.id);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = {
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      assignee: assignee ? Number(assignee) : null,
      due_date: dueDate || null,
    };
    try {
      const saved = task ? await taskApi.update(task.id, data) : await taskApi.create({ project: projectId, ...data });
      onSaved(saved);
      if (!task) onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Title" htmlFor="task-title">
        <Input
          id="task-title"
          required
          maxLength={200}
          value={title}
          disabled={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Design the onboarding flow"
        />
      </Field>
      <Field label="Description" htmlFor="task-description">
        <Textarea
          id="task-description"
          value={description}
          disabled={readOnly}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details, acceptance criteria, links…"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="task-status">
          <Select id="task-status" value={status} disabled={readOnly} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <Select id="task-priority" value={priority} disabled={readOnly} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assignee" htmlFor="task-assignee">
          <Select id="task-assignee" value={assignee} disabled={readOnly} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.full_name}
                {m.user.id === user?.id ? " (you)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline" htmlFor="task-due">
          <Input id="task-due" type="date" value={dueDate} disabled={readOnly} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      {task && (
        <p className="text-xs text-slate-500">
          Created by {task.created_by?.full_name ?? "a former member"} on {formatDate(task.created_at)}
          {task.completed_at && ` · Completed ${formatDate(task.completed_at)}`}
        </p>
      )}
      {!readOnly && (
        <div className="flex items-center gap-2">
          {canDelete && (
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
              Delete task
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {task ? "Close" : "Cancel"}
            </Button>
            <Button type="submit" loading={busy}>
              {task ? "Save changes" : "Create task"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );

  if (!task) return form;

  return (
    <div className="space-y-6">
      {form}
      <div className="border-t border-slate-100 pt-4">
        <div role="tablist" className="mb-4 flex gap-4 border-b border-slate-100">
          {(["comments", "activity"] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={cn(
                "-mb-px border-b-2 pb-2 text-sm font-medium capitalize",
                tab === name ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              {name === "comments" ? `Comments (${task.comment_count})` : "History"}
            </button>
          ))}
        </div>
        {tab === "comments" ? (
          <CommentsPanel taskId={task.id} readOnly={readOnly} canModerate={canManage} onChange={onCommentsChanged} />
        ) : (
          <TaskHistory taskId={task.id} updatedAt={task.updated_at} />
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete task?"
        message={
          <>
            <strong>{task.title}</strong> and its comments will be permanently deleted.
          </>
        }
        onConfirm={async () => {
          await taskApi.remove(task.id);
          onDeleted(task.id);
        }}
      />
    </div>
  );
}

function TaskHistory({ taskId, updatedAt }: { taskId: number; updatedAt: string }) {
  // updatedAt changes whenever the task is saved, which adds new history entries.
  const history = useLoader(() => activityApi.list({ task: taskId, limit: 100 }), [taskId, updatedAt]);
  if (history.loading) return <PageLoader label="Loading history…" />;
  if (history.error) return <Alert>{history.error}</Alert>;
  return <ActivityFeed items={history.data ?? []} showProject={false} />;
}
