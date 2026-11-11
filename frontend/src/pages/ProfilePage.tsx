import { useState, type FormEvent } from "react";

import { errorMessage } from "../api/client";
import { authApi } from "../api/endpoints";
import { Alert, Button, Card, Field, Input, PageHeader, PasswordInput, PasswordMatch } from "../components/ui";
import { useAuth } from "../context/AuthContext";

type Notice = { kind: "error" | "success"; text: string } | null;

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState<Notice>(null);

  async function toggleEmails(enabled: boolean) {
    setEmailBusy(true);
    setEmailNotice(null);
    try {
      setUser(await authApi.updateMe({ email_notifications: enabled }));
      setEmailNotice({ kind: "success", text: enabled ? "Email notifications are on." : "Email notifications are off." });
    } catch (err) {
      setEmailNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setEmailBusy(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileNotice(null);
    try {
      setUser(await authApi.updateMe({ full_name: fullName.trim() }));
      setProfileNotice({ kind: "success", text: "Profile updated." });
    } catch (err) {
      setProfileNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) {
      setPasswordNotice({ kind: "error", text: "New passwords don't match." });
      return;
    }
    setPasswordBusy(true);
    setPasswordNotice(null);
    try {
      const { detail } = await authApi.changePassword(currentPassword, newPassword);
      setPasswordNotice({ kind: "success", text: detail });
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setPasswordNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Your profile" description={user?.email} />
      <div className="max-w-2xl space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold text-brand-600">Profile</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            {profileNotice && <Alert kind={profileNotice.kind}>{profileNotice.text}</Alert>}
            <Field label="Email" htmlFor="profile-email" hint="Your email is your login and can't be changed.">
              <Input id="profile-email" value={user?.email ?? ""} disabled />
            </Field>
            <Field label="Full name" htmlFor="profile-name">
              <Input id="profile-name" required maxLength={150} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={profileBusy}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-display text-base font-bold text-brand-600">Notifications</h2>
          <p className="mb-4 text-sm text-slate-500">
            You always get in-app notifications (the bell icon). Choose whether they're emailed to you too.
          </p>
          {emailNotice && (
            <div className="mb-4">
              <Alert kind={emailNotice.kind}>{emailNotice.text}</Alert>
            </div>
          )}
          <label htmlFor="email-notifications" className="flex cursor-pointer items-start gap-3">
            <input
              id="email-notifications"
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
              checked={user?.email_notifications ?? true}
              disabled={emailBusy}
              onChange={(e) => void toggleEmails(e.target.checked)}
            />
            <span className="text-sm">
              <span className="block font-medium text-slate-900">Email me about activity</span>
              <span className="block text-slate-500">
                When I'm assigned a task, someone comments on my tasks, a task I created is completed, I'm added to an
                organization, or a deadline is coming up.
              </span>
            </span>
          </label>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold text-brand-600">Change password</h2>
          <form onSubmit={changePassword} className="space-y-4">
            {passwordNotice && <Alert kind={passwordNotice.kind}>{passwordNotice.text}</Alert>}
            <Field label="Current password" htmlFor="current-password">
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password" htmlFor="new-password">
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <Field label="Confirm new password" htmlFor="confirm-new-password">
                <PasswordInput
                  id="confirm-new-password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <PasswordMatch password={newPassword} confirm={confirm} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={passwordBusy}>
                Update password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
