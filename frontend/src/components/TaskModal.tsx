import { useState, type FormEvent } from "react";

import { errorMessage } from "../api/client";
import { activityApi, taskApi } from "../api/endpoints";
import type { Label, Membership, Priority, Task, TaskStatus } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { formatDate, relativeTime } from "../lib/format";
import { PRIORITIES, PRIORITY_META, projectColor, STATUSES, STATUS_META } from "../lib/meta";
import { useLoader } from "../lib/useLoader";
import { ActivityFeed } from "./ActivityFeed";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { CommentsPanel } from "./CommentsPanel";
import { LabelPicker } from "./LabelPicker";
import { ConfirmDialog, Modal } from "./Modal";
import { Alert, Avatar, Button, cn, Field, Input, PageLoader, Select, Textarea } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  /** Existing task to edit; omit to create a new one. */
  task?: Task | null;
  initialStatus?: TaskStatus;
  members: Membership[];
  /** The organization's labels; the task's organization is taken from them or the members list. */
  labels: Label[];
  onLabelCreated: (label: Label) => void;
  readOnly: boolean;
  canManage: boolean;
  onSaved: (task: Task) => void;
  onDeleted: (taskId: number) => void;
  onCommentsChanged?: () => void;
}

export function TaskModal({ open, ...props }: Readonly<Props>) {
  const { onClose, task } = props;
  return (
    <Modal open={open} onClose={onClose} title={task ? "Task details" : "New task"} size={task ? "xl" : "md"}>
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
  labels,
  onLabelCreated,
  readOnly,
  canManage,
  onSaved,
  onDeleted,
  onCommentsChanged,
}: Readonly<Omit<Props, "open">>) {
  const { user } = useAuth();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? initialStatus);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [assignee, setAssignee] = useState<string>(task?.assignee ? String(task.assignee) : "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [labelIds, setLabelIds] = useState<number[]>(() => task?.labels.map((l) => l.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<"comments" | "files" | "activity">("comments");
  const organizationId = members[0]?.organization;

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
      label_ids: labelIds,
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

  const statusField = (
    <Field label="Status" htmlFor="task-status">
      <Select id="task-status" value={status} disabled={readOnly} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </Select>
    </Field>
  );
  const priorityField = (
    <Field label="Priority" htmlFor="task-priority">
      <Select id="task-priority" value={priority} disabled={readOnly} onChange={(e) => setPriority(e.target.value as Priority)}>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </Select>
    </Field>
  );
  const assigneeField = (
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
  );
  const dueField = (
    <Field label="Deadline" htmlFor="task-due">
      <Input id="task-due" type="date" value={dueDate} disabled={readOnly} onChange={(e) => setDueDate(e.target.value)} />
    </Field>
  );
  const labelPicker = organizationId !== undefined && (
    <LabelPicker
      organizationId={organizationId}
      labels={labels}
      selected={labelIds}
      disabled={readOnly}
      onChange={setLabelIds}
      onCreated={onLabelCreated}
    />
  );

  if (!task) {
    return (
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Title" htmlFor="task-title">
          <Input
            id="task-title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Design the onboarding flow"
          />
        </Field>
        <Field label="Description" htmlFor="task-description">
          <Textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, acceptance criteria, links…"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {statusField}
          {priorityField}
          {assigneeField}
          {dueField}
        </div>
        {labelPicker}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create task
          </Button>
        </div>
      </form>
    );
  }

  // Existing task: a detail view like Jira or Linear, with the content on the left and properties on the right.
  // The title and description sit outside the <form> (next to the comments form), so they join it via `form=`.
  const formId = `task-form-${task.id}`;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <span className={cn("size-2 rounded-sm", projectColor(task.project))} />
            {task.project_name}
          </span>
          <span aria-hidden="true">/</span>
          <span className="font-mono">TF-{task.id}</span>
          <span className={cn("ml-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600")}>
            <span className={cn("size-1.5 rounded-full", STATUS_META[task.status].dot)} />
            {STATUS_META[task.status].label}
          </span>
        </div>
        {error && <Alert>{error}</Alert>}
        <div>
          <label htmlFor="task-title" className="sr-only">
            Title
          </label>
          <input
            id="task-title"
            form={formId}
            required
            maxLength={200}
            value={title}
            disabled={readOnly}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-lg border-0 bg-transparent px-2 py-1 -mx-2 font-display text-xl font-bold text-slate-900 ring-inset hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-600 disabled:bg-transparent"
          />
        </div>
        <div>
          <label htmlFor="task-description" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Description
          </label>
          <Textarea
            id="task-description"
            form={formId}
            value={description}
            disabled={readOnly}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, acceptance criteria, links…"
            className="min-h-32"
          />
        </div>

        <div>
          <div role="tablist" className="mb-4 flex gap-5 border-b border-slate-200">
            {(["comments", "files", "activity"] as const).map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
                className={cn(
                  "-mb-px border-b-2 pb-2 text-sm font-medium capitalize",
                  tab === name ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                {TAB_LABELS[name](task)}
              </button>
            ))}
          </div>
          {tab === "comments" && (
            <CommentsPanel taskId={task.id} readOnly={readOnly} canModerate={canManage} onChange={onCommentsChanged} />
          )}
          {tab === "files" && (
            <AttachmentsPanel taskId={task.id} readOnly={readOnly} canModerate={canManage} onChange={onCommentsChanged} />
          )}
          {tab === "activity" && <TaskHistory taskId={task.id} updatedAt={task.updated_at} />}
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/80 lg:sticky lg:top-4">
        <form id={formId} onSubmit={submit} className="space-y-4">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-slate-500">Details</h3>
          {statusField}
          {assigneeField}
          {priorityField}
          {dueField}
          {labelPicker}
          {!readOnly && (
            <Button type="submit" loading={busy} className="w-full">
              Save changes
            </Button>
          )}
        </form>
        <dl className="space-y-2 border-t border-slate-200 pt-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Reporter</dt>
            <dd className="flex items-center gap-1.5 font-medium text-slate-700">
              <Avatar user={task.created_by} size="sm" />
              {task.created_by?.full_name ?? "Former member"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-700">{formatDate(task.created_at)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Updated</dt>
            <dd className="text-slate-700">{relativeTime(task.updated_at)}</dd>
          </div>
          {task.completed_at && (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Completed</dt>
              <dd className="text-slate-700">{formatDate(task.completed_at)}</dd>
            </div>
          )}
        </dl>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setConfirmDelete(true)}
          >
            Delete task
          </Button>
        )}
      </aside>

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

const TAB_LABELS: Record<"comments" | "files" | "activity", (task: Task) => string> = {
  comments: (task) => `Comments (${task.comment_count})`,
  files: (task) => `Files (${task.attachment_count})`,
  activity: () => "History",
};

function TaskHistory({ taskId, updatedAt }: Readonly<{ taskId: number; updatedAt: string }>) {
  // updatedAt changes whenever the task is saved, which adds new history entries.
  const history = useLoader(() => activityApi.list({ task: taskId, limit: 100 }), [taskId, updatedAt]);
  if (history.loading) return <PageLoader label="Loading history…" />;
  if (history.error) return <Alert>{history.error}</Alert>;
  return <ActivityFeed items={history.data ?? []} showProject={false} />;
}
