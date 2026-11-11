import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { errorMessage } from "../api/client";
import { invitationApi } from "../api/endpoints";
import { Alert, Button, PageLoader, RoleBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import { useLoader } from "../lib/useLoader";
import { AuthLayout } from "./AuthLayout";

/** Where emailed invitation links land: /invite/:token. Works signed in or out. */
export function InvitePage() {
  const token = useParams().token ?? "";
  const { user, loading: authLoading, logout } = useAuth();
  const { reload, selectOrg } = useOrg();
  const navigate = useNavigate();
  const invite = useLoader(() => invitationApi.lookup(token), [token]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (invite.loading || authLoading) return <PageLoader label="Loading invitation…" />;

  if (invite.error || !invite.data) {
    return (
      <AuthLayout title="Invitation not found">
        <div className="space-y-4">
          <Alert>{invite.error ?? "This invitation link is invalid."}</Alert>
          <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-500">
            Go to TeamFlow →
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const data = invite.data;
  const here = `/invite/${token}`;
  const emailMatches = user?.email.toLowerCase() === data.email.toLowerCase();

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const membership = await invitationApi.accept(token);
      await reload();
      selectOrg(membership.organization);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function renderAction() {
    if (data.status === "accepted") {
      return (
        <Alert kind="success">
          This invitation has already been accepted.{" "}
          <Link to="/" className="font-semibold underline">
            Open TeamFlow
          </Link>
        </Alert>
      );
    }
    if (data.status === "expired") {
      return <Alert>This invitation has expired. Ask {data.invited_by ?? "the person who invited you"} to send a new one.</Alert>;
    }
    if (user && emailMatches) {
      return (
        <Button className="w-full" loading={busy} onClick={() => void accept()}>
          Join {data.organization_name}
        </Button>
      );
    }
    if (user) {
      return (
        <div className="space-y-3">
          <Alert kind="info">
            This invitation was sent to <strong>{data.email}</strong>, but you're logged in as <strong>{user.email}</strong>.
          </Alert>
          <Button variant="secondary" className="w-full" onClick={() => void logout()}>
            Log out and switch account
          </Button>
        </div>
      );
    }
    if (data.account_exists) {
      return (
        <Link
          to="/login"
          state={{ from: here }}
          className="flex w-full justify-center rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
        >
          Log in as {data.email} to accept
        </Link>
      );
    }
    return (
      <div className="space-y-3">
        <Link
          to={`/register?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(data.email)}`}
          className="flex w-full justify-center rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
        >
          Create your account to join
        </Link>
        <p className="text-center text-xs text-slate-500">
          Sign up with {data.email}, then accept this invitation.
        </p>
      </div>
    );
  }

  return (
    <AuthLayout
      title={`Join ${data.organization_name}`}
      subtitle={`${data.invited_by ?? "Someone"} invited you to collaborate on TeamFlow.`}
    >
      <div className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Organization</dt>
            <dd className="font-medium text-slate-900">{data.organization_name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Invited email</dt>
            <dd className="truncate font-medium text-slate-900">{data.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Your role</dt>
            <dd>
              <RoleBadge role={data.role} />
            </dd>
          </div>
        </dl>
        {renderAction()}
      </div>
    </AuthLayout>
  );
}
