import { useState, type FormEvent } from "react";

import { errorMessage } from "../api/client";
import { projectApi, teamApi } from "../api/endpoints";
import type { Project } from "../api/types";
import { useLoader } from "../lib/useLoader";
import { Modal } from "./Modal";
import { Alert, Button, Field, Input, Select, Textarea } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  project?: Project | null;
  onSaved: (project: Project) => void;
}

export function ProjectFormModal({ open, ...props }: Readonly<Props>) {
  return (
    <Modal open={open} onClose={props.onClose} title={props.project ? "Edit project" : "New project"}>
      <ProjectForm key={props.project?.id ?? "new"} {...props} />
    </Modal>
  );
}

function ProjectForm({ onClose, organizationId, project, onSaved }: Readonly<Omit<Props, "open">>) {
  const teams = useLoader(() => teamApi.list(organizationId), [organizationId]);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [dueDate, setDueDate] = useState(project?.due_date ?? "");
  const [team, setTeam] = useState(project?.team ? String(project.team) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = {
      name: name.trim(),
      description: description.trim(),
      due_date: dueDate || null,
      team: team ? Number(team) : null,
    };
    try {
      const saved = project
        ? await projectApi.update(project.id, data)
        : await projectApi.create({ organization: organizationId, ...data });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Project name" htmlFor="project-name">
        <Input id="project-name" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} placeholder="Website redesign" />
      </Field>
      <Field label="Description" htmlFor="project-description">
        <Textarea id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Goals, scope, links…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target date" htmlFor="project-due">
          <Input id="project-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Team" htmlFor="project-team" hint={teams.data?.length === 0 ? "Create teams on the Members & Teams page." : undefined}>
          <Select id="project-team" value={team} onChange={(e) => setTeam(e.target.value)} disabled={teams.loading}>
            <option value="">No team</option>
            {teams.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {project ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
