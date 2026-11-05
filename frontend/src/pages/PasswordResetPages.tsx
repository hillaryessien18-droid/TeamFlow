import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { errorMessage } from "../api/client";
import { authApi } from "../api/endpoints";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthLayout } from "./AuthLayout";

const backToLogin = (
  <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">
    Back to log in
  </Link>
);

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { detail } = await authApi.requestPasswordReset(email.trim());
      setSent(detail);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle={backToLogin}>
      {sent ? (
        <Alert kind="success">{sent}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">Enter the email you signed up with and we'll send you a reset link.</p>
          {error && <Alert>{error}</Alert>}
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { detail } = await authApi.confirmPasswordReset(uid, token, password);
      setDone(detail);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!uid || !token) {
    return (
      <AuthLayout title="Invalid reset link" subtitle={backToLogin}>
        <Alert>
          This link is incomplete. Request a new one from the{" "}
          <Link to="/forgot-password" className="underline">
            forgot password
          </Link>{" "}
          page.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle={backToLogin}>
      {done ? (
        <div className="space-y-4">
          <Alert kind="success">{done}</Alert>
          <Link
            to="/login"
            className="block w-full rounded-md bg-brand-600 px-3.5 py-2 text-center text-sm font-medium text-white hover:bg-brand-500"
          >
            Log in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="New password" htmlFor="new-password">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            Reset password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
