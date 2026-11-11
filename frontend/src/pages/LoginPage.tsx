import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { errorMessage } from "../api/client";
import { Alert, Button, Field, Input, PasswordInput } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Unable to log in."));
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Log in to TeamFlow"
      subtitle={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-brand-600 hover:text-brand-500">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-500">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
