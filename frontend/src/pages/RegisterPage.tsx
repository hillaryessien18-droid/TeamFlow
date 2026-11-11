import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { errorMessage } from "../api/client";
import { Alert, Button, Field, Input, PasswordInput, PasswordMatch } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "./AuthLayout";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  // Invitation links send people here with ?invite=<token>&email=<invited address>.
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const invited = Boolean(inviteToken);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({ full_name: fullName.trim(), email: email.trim(), password });
      navigate(inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Unable to create your account."));
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {invited && (
          <Alert kind="info">Sign up with the invited email, then accept the invitation from its link.</Alert>
        )}
        <Field label="Full name" htmlFor="full-name">
          <Input id="full-name" autoComplete="name" required maxLength={150} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters, not entirely numeric or too common.">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm-password">
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <PasswordMatch password={password} confirm={confirm} />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
