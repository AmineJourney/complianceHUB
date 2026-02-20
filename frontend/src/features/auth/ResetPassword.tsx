// src/features/auth/ResetPassword.tsx
// Handles: /reset-password?token=<token>
import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── 1. Validate token on mount ────────────────────────────────────────────
  const {
    data: tokenCheck,
    isLoading: tokenLoading,
    error: tokenError,
  } = useQuery({
    queryKey: ["reset-token-valid", token],
    queryFn: () => authApi.validateResetToken(token),
    enabled: !!token,
    retry: false,
  });

  // ── 2. Submit mutation ────────────────────────────────────────────────────
  const resetMutation = useMutation({
    mutationFn: authApi.confirmPasswordReset,
    onSuccess: () => {
      setSuccess(true);
    },
  });

  // Auto-redirect to login after success
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => navigate("/login"), 3000);
      return () => clearTimeout(t);
    }
  }, [success, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (newPassword.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    resetMutation.mutate({
      token,
      new_password: newPassword,
      new_password_confirm: confirmPassword,
    });
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (!token) {
    return (
      <ErrorState message="No reset token found in the URL. Please request a new reset link." />
    );
  }

  if (tokenLoading) {
    return (
      <Shell title="Verifying link…" description="">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Shell>
    );
  }

  if (tokenError || tokenCheck?.valid === false) {
    return (
      <ErrorState message="This reset link is invalid or has expired. Please request a new one." />
    );
  }

  if (success) {
    return (
      <Shell
        title="Password reset!"
        description="Your password has been updated."
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <CheckCircle className="h-14 w-14 text-green-500" />
          <p className="text-sm text-gray-500">
            Redirecting you to login in a moment…
          </p>
          <Button onClick={() => navigate("/login")}>Go to Login</Button>
        </div>
      </Shell>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  const apiError = resetMutation.error
    ? getErrorMessage(resetMutation.error)
    : null;

  return (
    <Shell
      title="Set new password"
      description="Choose a strong password for your account."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {(localError || apiError) && (
          <div className="flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {localError ?? apiError}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
              className="pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <PasswordStrength password={newPassword} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-600">Passwords don't match yet.</p>
          )}
          {confirmPassword &&
            newPassword === confirmPassword &&
            newPassword.length >= 8 && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Passwords match
              </p>
            )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={resetMutation.isPending}
        >
          {resetMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting…
            </>
          ) : (
            <>
              <KeyRound className="mr-2 h-4 w-4" />
              Reset Password
            </>
          )}
        </Button>
      </form>
    </Shell>
  );
}

// ── Password strength indicator ───────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Symbol", pass: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter((c) => c.pass).length;
  const colors = [
    "bg-red-400",
    "bg-orange-400",
    "bg-yellow-400",
    "bg-green-400",
    "bg-green-500",
  ];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];

  return (
    <div className="space-y-1.5 mt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {checks.map((c) => (
            <span
              key={c.label}
              className={`text-xs ${c.pass ? "text-green-600" : "text-gray-400"}`}
            >
              {c.pass ? "✓" : "·"} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span
            className={`text-xs font-medium ${colors[score].replace("bg-", "text-")}`}
          >
            {labels[score]}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Shell layout ──────────────────────────────────────────────────────────────

function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter className="justify-center">
          <Link
            to="/login"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Shell title="Invalid Link" description="">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <XCircle className="h-12 w-12 text-red-400" />
        <p className="text-sm text-gray-600">{message}</p>
        <Button asChild>
          <Link to="/forgot-password">Request a new reset link</Link>
        </Button>
      </div>
    </Shell>
  );
}
