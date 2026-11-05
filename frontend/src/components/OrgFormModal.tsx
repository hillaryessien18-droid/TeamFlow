import { useEffect, useState, type FormEvent } from "react";

import { errorMessage } from "../api/client";
import { orgApi } from "../api/endpoints";
import type { Organization } from "../api/types";
import { Modal } from "./Modal";
import { Alert, Button, Field, Input, Textarea } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  organization?: Organization | null;
  onSaved: (organization: Organization) => void;
}

export function OrgFormFields({ onSaved, organization, onCancel }: Omit<Props, "open" | "onClose"> & { onCancel?: () => void }) {
  const [name, setName] = useState(organization?.name ?? "");
  const [description, setDescription] = useState(organization?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = { name: name.trim(), description: description.trim() };
      const saved = organization ? await orgApi.update(organization.id, data) : await orgApi.create(data);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Organization name" htmlFor="org-name">
        <Input id="org-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
      </Field>
      <Field label="Description" htmlFor="org-description">
        <Textarea
          id="org-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this organization work on?"
        />
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy}>
          {organization ? "Save changes" : "Create organization"}
        </Button>
      </div>
    </form>
  );
}

export function OrgFormModal({ open, onClose, organization, onSaved }: Props) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (open) setKey((k) => k + 1);
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={organization ? "Edit organization" : "New organization"}>
      <OrgFormFields key={key} organization={organization} onSaved={onSaved} onCancel={onClose} />
    </Modal>
  );
}
