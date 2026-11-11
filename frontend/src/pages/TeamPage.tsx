import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { errorMessage } from "../api/client";
import { invitationApi, memberApi, teamApi } from "../api/endpoints";
import type { Invitation, Membership, Role, Team } from "../api/types";
import { MailIcon, PlusIcon } from "../components/icons";
import { ConfirmDialog, Modal } from "../components/Modal";
import { Alert, Avatar, Button, Card, EmptyState, Field, Input, PageHeader, PageLoader, RoleBadge, Select, Textarea } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import { formatDate, relativeTime } from "../lib/format";
import { ROLE_META, ROLES } from "../lib/meta";
import { useLoader } from "../lib/useLoader";

export function TeamPage() {
  const { user } = useAuth();
  const { current, canManage, isOwner, reload: reloadOrgs } = useOrg();
  const navigate = useNavigate();
  const members = useLoader(() => memberApi.list(current!.id), [current?.id]);
  const teams = useLoader(() => teamApi.list(current!.id), [current?.id]);
  const invitations = useLoader(
    () => (canManage && current ? invitationApi.list(current.id) : Promise.resolve([] as Invitation[])),
    [current?.id, canManage],
  );

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [removing, setRemoving] = useState<Membership | null>(null);
  const [teamForm, setTeamForm] = useState<Team | "new" | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  if (!current) return null;
  const orgId = current.id;

  async function invite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setNotice(null);
    try {
      const result = await invitationApi.create({ organization: orgId, email: email.trim(), role });
      if (result.status === "added") {
        const { membership } = result;
        setNotice({ kind: "success", text: `${membership.user.full_name} was added as ${ROLE_META[membership.role].label}.` });
        await Promise.all([members.reload(true), reloadOrgs()]);
      } else {
        setNotice({ kind: "success", text: `Invitation emailed to ${result.invitation.email}. They'll join when they accept it.` });
        await invitations.reload(true);
      }
      setEmail("");
      setRole("member");
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(membership: Membership, next: Role) {
    setNotice(null);
    try {
      await memberApi.updateRole(membership.id, next);
      await members.reload(true);
      if (membership.user.id === user?.id) await reloadOrgs();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  }

  /** Which role options the current user may pick for this row (mirrors the API rules). */
  function roleOptions(membership: Membership): Role[] {
    if (isOwner) return ROLES;
    if (membership.role === "owner") return [];
    return ["admin", "member"];
  }

  async function invitationAction(action: () => Promise<unknown>, success: string) {
    setNotice(null);
    try {
      await action();
      setNotice({ kind: "success", text: success });
      await invitations.reload(true);
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  }

  const ownerCount = members.data?.filter((m) => m.role === "owner").length ?? 0;

  function renderTeams() {
    if (teams.loading) return <PageLoader />;
    if (teams.data?.length === 0) {
      return (
        <EmptyState
          title="No teams yet"
          description="Teams group members (e.g. Design, Engineering) and can be attached to projects."
        />
      );
    }
    return (
      <ul className="grid gap-4 sm:grid-cols-2">
        {teams.data?.map((team) => (
          <li key={team.id} className="rounded-lg p-4 ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-slate-900">{team.name}</h3>
              {canManage && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setTeamForm(team)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setDeletingTeam(team)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
            {team.description && <p className="mt-1 text-sm text-slate-500">{team.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1">
              {team.members.length === 0 ? (
                <span className="text-xs text-slate-400">No members</span>
              ) : (
                team.members.map((u) => <Avatar key={u.id} user={u} size="sm" />)
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  function renderMembers() {
    if (members.loading) return <PageLoader />;
    if (members.error) {
      return (
        <div className="p-5">
          <Alert>{members.error}</Alert>
        </div>
      );
    }
    return (
      <ul className="divide-y divide-slate-100">
        {members.data?.map((m) => {
          const isMe = m.user.id === user?.id;
          const options = roleOptions(m);
          const canEditRole = canManage && options.length > 0 && !(m.role === "owner" && ownerCount <= 1);
          const canRemove = isMe ? !(m.role === "owner" && ownerCount <= 1) : canManage && (isOwner || m.role !== "owner");
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Avatar user={m.user} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {m.user.full_name} {isMe && <span className="text-slate-400">(you)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {m.user.email} · joined {formatDate(m.joined_at)}
                </p>
              </div>
              {canEditRole ? (
                <Select
                  aria-label={`Role for ${m.user.full_name}`}
                  value={m.role}
                  onChange={(e) => void changeRole(m, e.target.value as Role)}
                  className="w-28 py-1.5"
                >
                  {options.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </Select>
              ) : (
                <RoleBadge role={m.role} />
              )}
              {canRemove && (
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setRemoving(m)}>
                  {isMe ? "Leave" : "Remove"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <PageHeader title="Members & Teams" description={`People in ${current.name} and how they're grouped.`} />

      {notice && (
        <div className="mb-4">
          <Alert kind={notice.kind}>{notice.text}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-base font-bold text-brand-600">Members ({members.data?.length ?? "…"})</h2>
            </div>
            {renderMembers()}
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-base font-bold text-brand-600">Teams</h2>
              {canManage && (
                <Button size="sm" onClick={() => setTeamForm("new")}>
                  <PlusIcon className="size-4" /> New team
                </Button>
              )}
            </div>
            <div className="p-5">
              {renderTeams()}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {canManage ? (
            <Card className="p-5">
              <h2 className="font-display text-base font-bold text-brand-600">Invite a member</h2>
              <p className="mt-1 text-xs text-slate-500">
                People who already use TeamFlow are added right away. Anyone else gets an email invitation.
              </p>
              <form onSubmit={invite} className="mt-4 space-y-3">
                <Field label="Email" htmlFor="invite-email">
                  <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
                </Field>
                <Field label="Role" htmlFor="invite-role">
                  <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    {(isOwner ? ROLES : (["admin", "member"] as Role[])).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_META[r].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" className="w-full" loading={inviting}>
                  <MailIcon className="size-4" /> Send invite
                </Button>
              </form>
            </Card>
          ) : null}
          {canManage && (invitations.data?.length ?? 0) > 0 && (
            <Card className="p-5">
              <h2 className="font-display text-base font-bold text-brand-600">Pending invitations</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {invitations.data?.map((invite) => (
                  <li key={invite.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-slate-900">{invite.email}</p>
                      <RoleBadge role={invite.role} />
                    </div>
                    <p className={invite.is_expired ? "text-xs text-red-600" : "text-xs text-slate-500"}>
                      {invite.is_expired ? "Expired" : `Sent ${relativeTime(invite.created_at)}`}
                      {invite.invited_by && ` by ${invite.invited_by.full_name}`}
                    </p>
                    <div className="mt-1.5 flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void invitationAction(() => invitationApi.resend(invite.id), `Invitation re-sent to ${invite.email}.`)}
                      >
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => void invitationAction(() => invitationApi.revoke(invite.id), `Invitation for ${invite.email} revoked.`)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="font-display text-base font-bold text-brand-600">Roles</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt><RoleBadge role="owner" /></dt>
                <dd className="mt-1 text-slate-600">Everything, including deleting the organization and managing other owners.</dd>
              </div>
              <div>
                <dt><RoleBadge role="admin" /></dt>
                <dd className="mt-1 text-slate-600">Manage projects, teams and members (except owners).</dd>
              </div>
              <div>
                <dt><RoleBadge role="member" /></dt>
                <dd className="mt-1 text-slate-600">View projects, create and update tasks, comment.</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing?.user.id === user?.id ? "Leave organization?" : "Remove member?"}
        confirmLabel={removing?.user.id === user?.id ? "Leave" : "Remove"}
        message={
          removing?.user.id === user?.id
            ? `You'll lose access to ${current.name} and its projects.`
            : `${removing?.user.full_name} will lose access and be unassigned from their tasks.`
        }
        onConfirm={async () => {
          const leaving = removing!.user.id === user?.id;
          await memberApi.remove(removing!.id);
          if (leaving) {
            await reloadOrgs();
            navigate("/");
          } else {
            await Promise.all([members.reload(true), teams.reload(true), reloadOrgs()]);
          }
        }}
      />
      <TeamFormModal
        open={teamForm !== null}
        onClose={() => setTeamForm(null)}
        organizationId={orgId}
        team={teamForm === "new" ? null : teamForm}
        members={members.data ?? []}
        onSaved={() => void teams.reload(true)}
      />
      <ConfirmDialog
        open={deletingTeam !== null}
        onClose={() => setDeletingTeam(null)}
        title="Delete team?"
        message={`"${deletingTeam?.name}" will be deleted. Its members and projects are kept.`}
        onConfirm={async () => {
          await teamApi.remove(deletingTeam!.id);
          await teams.reload(true);
        }}
      />
    </>
  );
}

interface TeamFormProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  team: Team | null;
  members: Membership[];
  onSaved: () => void;
}

function TeamFormModal({ open, ...props }: Readonly<TeamFormProps>) {
  return (
    <Modal open={open} onClose={props.onClose} title={props.team ? "Edit team" : "New team"}>
      <TeamForm key={props.team?.id ?? "new"} {...props} />
    </Modal>
  );
}

function TeamForm({ onClose, organizationId, team, members, onSaved }: Readonly<Omit<TeamFormProps, "open">>) {
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [selected, setSelected] = useState<Set<number>>(() => new Set(team?.members.map((u) => u.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = { organization: organizationId, name: name.trim(), description: description.trim(), member_ids: [...selected] };
    try {
      if (team) await teamApi.update(team.id, data);
      else await teamApi.create(data);
      onSaved();
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
      <Field label="Team name" htmlFor="team-name">
        <Input id="team-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering" />
      </Field>
      <Field label="Description" htmlFor="team-description">
        <Textarea id="team-description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Members</legend>
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md p-1 ring-1 ring-slate-200">
          {members.map((m) => (
            <li key={m.user.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 text-brand-600"
                  checked={selected.has(m.user.id)}
                  onChange={() => toggle(m.user.id)}
                />
                <Avatar user={m.user} size="sm" />
                <span className="text-sm text-slate-700">{m.user.full_name}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {team ? "Save team" : "Create team"}
        </Button>
      </div>
    </form>
  );
}
