import { useState, type FormEvent } from "react";

import { errorMessage } from "../api/client";
import { authApi } from "../api/endpoints";
import { Alert, Button, Card, Field, Input, PageHeader } from "../components/ui";
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
          <h2 className="mb-4 font-display text-base font-bold text-brand-600">Change password</h2>
          <form onSubmit={changePassword} className="space-y-4">
            {passwordNotice && <Alert kind={passwordNotice.kind}>{passwordNotice.text}</Alert>}
            <Field label="Current password" htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password" htmlFor="new-password">
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <Field label="Confirm new password" htmlFor="confirm-new-password">
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
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
