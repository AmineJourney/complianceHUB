/* eslint-disable @typescript-eslint/no-unused-vars */
// src/features/auth/AcceptInvite.tsx
// Handles the public invite link: /invite/:token
// Works for both logged-in users and newcomers.
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { teamApi } from "@/api/team";
import { authApi } from "@/api/auth";
import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  Building2,
  UserCheck,
  LogIn,
  UserPlus,
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  manager: "bg-indigo-100 text-indigo-800 border-indigo-200",
  analyst: "bg-green-100 text-green-800 border-green-200",
  auditor: "bg-yellow-100 text-yellow-800 border-yellow-200",
  viewer: "bg-gray-100 text-gray-800 border-gray-200",
};

export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user, setCompany } = useAuthStore();

  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // ── 1. Fetch invite preview (public — no auth needed) ─────────────────────
  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => teamApi.previewInvitation(token!),
    enabled: !!token,
    retry: false,
  });

  // ── 2. Accept mutation ─────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: () => teamApi.acceptInvitation(token!),
    onSuccess: async (data) => {
      // Fetch fresh membership and set company in store
      try {
        const memberships = await authApi.getMemberships({
          company: data.company.id,
        });
        const mem = memberships.results[0];
        if (mem) setCompany(data.company, mem);
      } catch {
        // Non-fatal — user can select company manually
      }
      setAccepted(true);
    },
    onError: (err) => {
      setAcceptError(getErrorMessage(err));
    },
  });

  // ── If already accepted, redirect to dashboard after a moment ─────────────
  useEffect(() => {
    if (accepted) {
      const t = setTimeout(() => navigate("/dashboard"), 2500);
      return () => clearTimeout(t);
    }
  }, [accepted, navigate]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const redirectToLogin = () => navigate(`/login?next=/invite/${token}`);

  const redirectToRegister = () => navigate(`/register?next=/invite/${token}`);

  // ─────────────────────────────────────────────────────────────────────────

  if (!token) {
    return <InviteError message="Invalid invite link — no token found." />;
  }

  if (previewLoading) {
    return (
      <InviteShell>
        <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading invitation…</p>
        </div>
      </InviteShell>
    );
  }

  if (previewError || !preview) {
    return (
      <InviteError message="This invitation link is invalid or has already been used." />
    );
  }

  if (!preview.is_valid) {
    const reason =
      preview.is_valid === false
        ? "This invitation has expired or been revoked."
        : "This invitation is no longer valid.";
    return <InviteError message={reason} />;
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (accepted) {
    return (
      <InviteShell>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <CheckCircle className="h-14 w-14 text-green-500" />
          <h2 className="text-xl font-semibold text-gray-900">
            You've joined {preview.company_name}!
          </h2>
          <p className="text-sm text-gray-500">
            Redirecting you to the dashboard…
          </p>
          <Button onClick={() => navigate("/dashboard")} className="mt-2">
            Go to Dashboard
          </Button>
        </div>
      </InviteShell>
    );
  }

  // ── Main invite card ──────────────────────────────────────────────────────
  return (
    <InviteShell>
      {/* Invite details */}
      <div className="flex flex-col items-center gap-2 pb-4 text-center">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          You're invited to join
        </h2>
        <p className="text-2xl font-semibold text-primary">
          {preview.company_name}
        </p>

        <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
          <span className="text-sm text-gray-500">as</span>
          <Badge
            variant="outline"
            className={`capitalize text-sm ${ROLE_COLORS[preview.role] ?? ""}`}
          >
            {preview.role}
          </Badge>
        </div>

        <p className="text-xs text-gray-400 mt-1">
          Invited by <strong>{preview.invited_by_name}</strong>
          {" · "}expires{" "}
          {new Date(preview.expires_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>

        {preview.email && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
            This invite is restricted to <strong>{preview.email}</strong>
          </p>
        )}
      </div>

      {/* Error */}
      {acceptError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-3">
          {acceptError}
        </div>
      )}

      {/* Actions */}
      {isAuthenticated ? (
        // Logged-in path
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-2">
            <UserCheck className="h-4 w-4 flex-shrink-0" />
            <span>
              You're signed in as <strong>{user?.email}</strong>
            </span>
          </div>

          <Button
            className="w-full"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining…
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Accept &amp; Join {preview.company_name}
              </>
            )}
          </Button>

          <p className="text-center text-xs text-gray-400">
            Not {user?.email}?{" "}
            <button
              className="text-primary underline underline-offset-2"
              onClick={redirectToLogin}
            >
              Sign in with a different account
            </button>
          </p>
        </div>
      ) : (
        // Guest path — must log in or register first
        <div className="space-y-3">
          <p className="text-sm text-gray-600 text-center">
            Sign in or create an account to accept this invitation.
          </p>

          <Button className="w-full" onClick={redirectToLogin}>
            <LogIn className="mr-2 h-4 w-4" />
            Sign In to Accept
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={redirectToRegister}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Create Account &amp; Accept
          </Button>
        </div>
      )}
    </InviteShell>
  );
}

// ── Shell layout ─────────────────────────────────────────────────────────────

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
          </div>
          <CardTitle className="text-base font-medium text-gray-500">
            Compliance Platform — Invitation
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter className="justify-center">
          <p className="text-xs text-gray-400">
            Already have access?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Go to login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <InviteShell>
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <XCircle className="h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          Invalid Invitation
        </h2>
        <p className="text-sm text-gray-500">{message}</p>
        <Button asChild className="mt-2">
          <Link to="/login">Back to Login</Link>
        </Button>
      </div>
    </InviteShell>
  );
}
