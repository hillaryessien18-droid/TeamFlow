import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { orgApi } from "../api/endpoints";
import { ConfirmDialog } from "../components/Modal";
import { OrgFormFields } from "../components/OrgFormModal";
import { Alert, Button, Card, Field, Input, PageHeader, RoleBadge } from "../components/ui";
import { useOrg } from "../context/OrgContext";
import { formatDate } from "../lib/format";

export function SettingsPage() {
  const { current, canManage, isOwner, reload } = useOrg();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  if (!current) return null;

  return (
    <>
      <PageHeader title="Organization settings" description={`Created ${formatDate(current.created_at)}`} />
      <div className="max-w-2xl space-y-6">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">General</h2>
            {current.my_role && <RoleBadge role={current.my_role} />}
          </div>
          {saved && (
            <div className="mb-4">
              <Alert kind="success">Organization updated.</Alert>
            </div>
          )}
          {canManage ? (
            <OrgFormFields
              key={current.id}
              organization={current}
              onSaved={async () => {
                await reload();
                setSaved(true);
              }}
            />
          ) : (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{current.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Description</dt>
                <dd className="text-slate-700">{current.description || "—"}</dd>
              </div>
              <p className="text-xs text-slate-500">Only admins and owners can change these settings.</p>
            </dl>
          )}
        </Card>

        {isOwner && (
          <Card className="p-5 ring-red-200">
            <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
            <p className="mt-1 text-sm text-slate-600">
              Deleting the organization permanently removes all of its projects, tasks, comments and history.
            </p>
            <Button variant="danger" className="mt-4" onClick={() => setDeleting(true)}>
              Delete organization
            </Button>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={deleting}
        onClose={() => {
          setDeleting(false);
          setConfirmName("");
        }}
        title="Delete organization?"
        confirmLabel="Delete forever"
        message={
          <div className="space-y-3">
            <p>
              This cannot be undone. Type <strong>{current.name}</strong> to confirm.
            </p>
            <Field label="Organization name" htmlFor="confirm-org-name">
              <Input id="confirm-org-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            </Field>
          </div>
        }
        onConfirm={async () => {
          if (confirmName.trim() !== current.name) throw new Error("The name you typed doesn't match.");
          await orgApi.remove(current.id);
          await reload();
          navigate("/");
        }}
      />
    </>
  );
}
